// RQ2 experiment: drives Brain (src/brain.js) with scripted caller turns —
// no Twilio, no STT, no TTS, no DB. Isolates the LLM leg, which is where the
// self-dialogue failure mode and the GLUED_SEGMENT heuristic both live.
//
// Free, local run (default — zero cost, Ollama must be running):
//   node research/hallucination_harness.mjs
//
// Choose models explicitly:
//   HARNESS_MODELS=llama3:8b,qwen2.5:7b node research/hallucination_harness.mjs
//
// For each (model x singleSegment on/off x scenario), runs the full scripted
// conversation and records, per turn, the raw text the model produced and
// whether the production singleSegment cut fired. Nothing here edits
// src/brain.js — truncation is observed by handing Brain a stub logger and
// watching for its one relevant warn() call.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Brain } from '../src/brain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fixed, inline clinic profile — fictional, so this experiment is fully
// reproducible and never depends on any real business's data.
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
- Answer only what the caller actually asked. Keep replies short — one or two sentences,
  like a real front-desk conversation, not a monologue.
- Never invent what the caller said. Never continue the conversation on their behalf.
- If the call is clearly done, end with [END:done] at the very end of your reply.
- If you genuinely don't know something a human receptionist would check, say so and
  raise it with [FLAG:the exact question] at the end of your reply.`;

const SCENARIOS = [
  {
    id: 'booking-simple',
    turns: [
      "Hi, I'd like to book an appointment for a check-up.",
      'Does Tuesday afternoon work?',
      'My name is John Smith, phone is 555-123-4567.',
    ],
  },
  {
    id: 'insurance-question',
    turns: [
      'Do you accept Blue Cross insurance?',
      'Okay, and how much would a regular visit cost without insurance?',
      'Alright, can I book for next week then?',
    ],
  },
  {
    id: 'reschedule',
    turns: [
      'I need to reschedule my appointment from Friday.',
      'Can we move it to the following Monday morning instead?',
      'Thanks, that works for me.',
    ],
  },
  {
    id: 'angry-caller',
    turns: [
      "I've been waiting all week for someone to call me back about my prescription refill.",
      "This is the third time I'm calling about this, nobody is helping me.",
      'Fine. Just make sure someone calls me back today.',
    ],
  },
  {
    id: 'ambiguous-multi-ask',
    turns: [
      'Hi, quick questions — are you open on weekends, and do you do walk-ins, and also do you do flu shots?',
      'Okay, and if I came in today for a flu shot, about how long is the wait usually?',
    ],
  },
];

const MODELS = (process.env.HARNESS_MODELS || 'llama3:8b').split(',').map((s) => s.trim()).filter(Boolean);

function makeLogger(onTruncated) {
  return {
    warn: (msg) => {
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      if (text.includes('dropped extra text glued after the first reply')) onTruncated();
    },
  };
}

async function runScenario(scenario, { singleSegment, model }) {
  const turnResults = [];
  for (const userTurn of scenario.turns) {
    let truncated = false;
    const log = makeLogger(() => { truncated = true; });
    // A fresh Brain per turn, replayed with prior turns, mirrors a real call
    // closely enough for this experiment while keeping each turn independently retryable.
    const brain = new Brain(SYSTEM_PROMPT, log, { singleSegment, model });
    for (const prior of turnResults) {
      brain.addUser(prior.userTurn);
      brain.addAssistant(prior.rawReplyText);
    }
    brain.addUser(userTurn);

    const sentences = [];
    let result;
    try {
      result = await brain.respond({ onSentence: (s) => sentences.push(s) });
    } catch (err) {
      turnResults.push({ userTurn, error: String(err?.message || err) });
      break;
    }
    turnResults.push({
      userTurn,
      rawReplyText: result.text,
      spokenSentences: sentences,
      truncatedBySingleSegment: truncated,
      transfer: result.transfer,
      end: result.end,
      flag: result.flag,
    });
    if (result.end) break;
  }
  return turnResults;
}

async function main() {
  const outDir = path.join(__dirname, 'runs');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`LLM endpoint: ${process.env.LLM_BASE_URL || 'http://localhost:11434/v1/chat/completions (default)'}`);
  console.log(`Models: ${MODELS.join(', ')}`);

  for (const model of MODELS) {
    for (const singleSegment of [false, true]) {
      const label = `${model.replace(/[:/]/g, '_')}__singleSegment-${singleSegment}`;
      const allResults = {};
      for (const scenario of SCENARIOS) {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
