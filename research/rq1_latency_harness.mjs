// RQ1 experiment: measures real per-component latency of the local
// STT -> LLM -> TTS pipeline, to compare against the published enterprise
// benchmarks in PROJECT.md §1 (Salesforce arXiv 2603.05413: TTFA 755ms,
// STT ~337ms; telecom arXiv 2508.04721: ASR 0.05s, TTS 0.28s, LLM 0.67s).
//
// Requires research/stt_tts_server.py running first (python research/stt_tts_server.py)
// — it keeps faster-whisper and Piper warm so we measure real per-call
// inference latency, not one-time model-load time.
//
// Run:
//   HARNESS_MODELS=llama3:8b,qwen2.5:7b node research/rq1_latency_harness.mjs
//
// Per turn, measures:
//   - sttMs   : time for the warm server to transcribe synthetic caller audio
//   - llmMs   : time from request start to the FIRST complete sentence
//               (mirrors the real pipeline, which starts speaking the
//               moment the first sentence is ready — see Brain.respond()
//               in src/brain.js)
//   - ttsMs   : time for the warm server to synthesize that first sentence
//               into audio (a genuine "time-to-first-audio" proxy)
//   - totalMs : sttMs + llmMs + ttsMs, the full turn's round trip

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Brain } from '../src/brain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = 'http://127.0.0.1:8765';

const SYSTEM_PROMPT = `You are the virtual front-desk receptionist for Lakeview Family Clinic,
answering an INBOUND phone call. You are an AI assistant, and you say so plainly if asked —
never claim to be a person.

Clinic facts:
Hours: Monday-Friday 9am-5pm, Saturday 9am-1pm, closed Sunday.
Services: family medicine, annual physicals, vaccinations, minor illness and injury, lab draws.
New patients: accepted. Same-week appointments are usually available.
Insurance: most major plans accepted — confirm coverage when booking.
Address: 100 Main Street.

Rules:
- Answer only what the caller actually asked. Keep replies short — one or two sentences.
- Never invent what the caller said. Never continue the conversation on their behalf.
- If the call is clearly done, end with [END:done] at the very end of your reply.`;

// A fixed set of single-turn caller lines — enough to get a stable latency
// distribution without needing the multi-turn scenario structure RQ2 uses.
// n=30 (not 10) specifically so p90 is a meaningful statistic rather than
// just "the 9th of 10 values."
const CALLER_LINES = [
  "Hi, I'd like to book an appointment for a check-up.",
  'Do you accept Blue Cross insurance?',
  'I need to reschedule my appointment from Friday.',
  'Are you open on Saturdays?',
  'How much does a regular visit cost without insurance?',
  'Can I get a flu shot today?',
  'Do you do walk-ins?',
  "What's your address?",
  'Is Dr. Patel available this week?',
  'Can you fax a referral letter for me?',
  'What time do you close on weekdays?',
  'Do I need a referral to see a specialist here?',
  'Can my daughter be seen without me present?',
  'Is there a charge for cancelling an appointment?',
  'Do you offer same-day sick visits?',
  'Can you send my records to another clinic?',
  'Is parking available on site?',
  'Do you accept new patients right now?',
  'What should I bring to my first appointment?',
  'Can I get a prescription refill without a visit?',
  'How long does a typical physical take?',
  'Do you have a pediatrician on staff?',
  'Is telehealth an option for follow-ups?',
  'Can I pay my copay over the phone?',
  'What vaccines do you currently have in stock?',
  'Is there a waitlist for same-week appointments?',
  'Can you confirm my appointment time for tomorrow?',
  'Do you test for strep throat on site?',
  'Is Dr. Patel taking new patients?',
  'Can I switch my appointment to a different provider?',
];

const MODELS = (process.env.HARNESS_MODELS || 'llama3:8b').split(',').map((s) => s.trim()).filter(Boolean);

function quietLogger() {
  return { warn: () => {} };
}

async function synthesize(text) {
  const t0 = Date.now();
  const res = await fetch(`${SERVER}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const serverMs = Number(res.headers.get('x-latency-ms'));
  return { wav: buf, ms: serverMs, wallMs: Date.now() - t0 };
}

async function transcribe(wavBuffer) {
  const res = await fetch(`${SERVER}/stt`, { method: 'POST', body: wavBuffer });
  const json = await res.json();
  return json; // { text, ms }
}

async function runTurn(callerLine, model) {
  // Synthetic "caller audio" — not part of the measured pipeline latency,
  // just how we get realistic WAV input to feed the STT leg at all.
  const callerAudio = await synthesize(callerLine);

  const sttResult = await transcribe(callerAudio.wav);
  const sttMs = sttResult.ms;

  const brain = new Brain(SYSTEM_PROMPT, quietLogger(), { singleSegment: true, model });
  brain.addUser(sttResult.text || callerLine);

  let firstSentence = null;
  let firstTokenMs = null;
  const llmStart = Date.now();
  await brain.respond({
    onFirstToken: () => {
      if (firstTokenMs === null) firstTokenMs = Date.now() - llmStart;
    },
    onSentence: (s) => {
      if (!firstSentence) firstSentence = s;
    },
  });
  const llmFirstSentenceMs = Date.now() - llmStart;

  let ttsMs = null;
  if (firstSentence) {
    const ttsResult = await synthesize(firstSentence);
    ttsMs = ttsResult.ms;
  }

  return {
    callerLine,
    transcribedAs: sttResult.text,
    firstSentence,
    sttMs,
    llmFirstTokenMs: firstTokenMs,
    llmFirstSentenceMs,
    ttsMs,
    totalMs: sttMs + llmFirstSentenceMs + (ttsMs ?? 0),
  };
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  // Sanity-check the server is up before burning any LLM calls.
  try {
    await fetch(`${SERVER}/tts`, { method: 'POST', body: JSON.stringify({ text: 'ping' }), headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(`Cannot reach ${SERVER} — start it first: python research/stt_tts_server.py`);
    process.exit(1);
  }

  const outDir = path.join(__dirname, 'runs');
  fs.mkdirSync(outDir, { recursive: true });

  for (const model of MODELS) {
    console.log(`\n=== ${model} ===`);
    // Warm-up call, discarded. Ollama unloads idle models after a timeout,
    // so the first real call after a server (re)start pays a one-time
    // model-load cost that isn't representative of steady-state per-turn
    // latency in a continuously-running voice service. One throwaway call
    // here keeps that cost out of the measured distribution.
    process.stdout.write('  (warm-up, discarded) ... ');
    const warmupStart = Date.now();
    await runTurn('Hello, is anyone there?', model);
    console.log(`${Date.now() - warmupStart}ms`);

    const turns = [];
    for (const line of CALLER_LINES) {
      process.stdout.write(`  "${line.slice(0, 40)}..." ... `);
      const result = await runTurn(line, model);
      turns.push(result);
      console.log(`stt=${result.sttMs.toFixed(0)}ms llm_firstToken=${result.llmFirstTokenMs}ms llm_firstSentence=${result.llmFirstSentenceMs}ms tts=${(result.ttsMs ?? 0).toFixed(0)}ms total=${result.totalMs.toFixed(0)}ms`);
    }

    const summary = {
      model,
      n: turns.length,
      sttMs: { p50: percentile(turns.map((t) => t.sttMs), 50), p90: percentile(turns.map((t) => t.sttMs), 90) },
      llmFirstTokenMs: { p50: percentile(turns.map((t) => t.llmFirstTokenMs), 50), p90: percentile(turns.map((t) => t.llmFirstTokenMs), 90) },
      llmFirstSentenceMs: { p50: percentile(turns.map((t) => t.llmFirstSentenceMs), 50), p90: percentile(turns.map((t) => t.llmFirstSentenceMs), 90) },
      ttsMs: { p50: percentile(turns.map((t) => t.ttsMs ?? 0), 50), p90: percentile(turns.map((t) => t.ttsMs ?? 0), 90) },
      totalMs: { p50: percentile(turns.map((t) => t.totalMs), 50), p90: percentile(turns.map((t) => t.totalMs), 90) },
    };
    console.log('Summary:', JSON.stringify(summary, null, 2));

    const label = model.replace(/[:/]/g, '_');
    fs.writeFileSync(path.join(outDir, `rq1_${label}.json`), JSON.stringify({ summary, turns }, null, 2));
    console.log(`Wrote research/runs/rq1_${label}.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
