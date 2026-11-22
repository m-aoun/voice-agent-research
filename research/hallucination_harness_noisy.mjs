// RQ2, noisy-input condition: re-runs the exact same scripted scenarios as
// research/hallucination_harness.mjs, but with each caller turn corrupted to
// approximate raw, punctuation-free streaming ASR output (lowercase, no
// punctuation) instead of the clean, well-punctuated English text the main
// experiment feeds the model.
//
// Motivation: a reviewer correctly pointed out that always feeding the LLM
// clean, grammatically perfect caller text is a real external-validity gap —
// the production failure mode this paper studies was observed on REAL calls,
// where the caller's turn reaches the LLM only after passing through a real
// STT engine, which does not reliably restore punctuation or capitalization.
// This condition tests whether messier caller input makes the LLM more
// likely to produce a glued, self-dialogue-style reply.
//
// Honesty note: this is a deliberately simple, low-cost approximation (strip
// punctuation, lowercase) of what raw ASR output characteristically looks
// like — it is NOT a full acoustic/ASR error model (no substituted or
// dropped words, no homophone confusion). We report it as exactly that: a
// test of robustness to the ABSENCE of clean punctuation/capitalization
// cues, not a full simulation of real-world ASR error rates.
//
//   node research/hallucination_harness_noisy.mjs
//   HARNESS_MODELS=llama3:8b,qwen2.5:7b HARNESS_TEMPERATURES=0.4,0.8 \
//     node research/hallucination_harness_noisy.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, runScenario } from './hallucination_harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Approximates raw streaming-ASR output: no punctuation, no capitalization,
// collapsed whitespace. This is what faster-whisper (and most STT engines)
// produce before any punctuation-restoration post-processing step.
function toNoisyAsrStyle(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:—–]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISY_SCENARIOS = SCENARIOS.map((s) => ({
  id: s.id,
  turns: s.turns.map(toNoisyAsrStyle),
}));

const MODELS = (process.env.HARNESS_MODELS || 'llama3:8b,qwen2.5:7b').split(',').map((s) => s.trim()).filter(Boolean);
const TEMPERATURES = (process.env.HARNESS_TEMPERATURES || '0.4,0.8').split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));

async function main() {
  const outDir = path.join(__dirname, 'runs');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[noisy-input condition] LLM endpoint: ${process.env.LLM_BASE_URL || 'http://localhost:11434/v1/chat/completions (default)'}`);
  console.log(`Models: ${MODELS.join(', ')}`);
  console.log(`Temperatures: ${TEMPERATURES.join(', ')}`);
  console.log(`Example corrupted turn: ${JSON.stringify(NOISY_SCENARIOS[0].turns[0])}`);

  for (const model of MODELS) {
    for (const temperature of TEMPERATURES) {
      process.env.LLM_TEMPERATURE = String(temperature);
      for (const singleSegment of [false, true]) {
        const label = `noisy__${model.replace(/[:/]/g, '_')}__temp-${temperature}__singleSegment-${singleSegment}`;
        const allResults = {};
        for (const scenario of NOISY_SCENARIOS) {
          process.stdout.write(`  ${label} / ${scenario.id} ... `);
          const started = Date.now();
          allResults[scenario.id] = await runScenario(scenario, { singleSegment, model });
          console.log(`done (${Date.now() - started}ms)`);
        }
        const outFile = path.join(outDir, `${label}.json`);
        fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
        console.log(`Wrote ${outFile}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
