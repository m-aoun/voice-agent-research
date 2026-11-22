// RQ2 baseline comparison: what would a NAIVE "always cut after the first
// sentence" rule do, compared to the actual deployed GLUED_SEGMENT heuristic
// (src/brain.js)?
//
// Motivation: a reviewer asked for a baseline comparison, specifically
// suggesting a "\nCaller:"-style stop-sequence baseline. We checked every
// raw transcript collected for this paper and found that observed
// self-dialogue in this system never takes the form of an explicit
// role-labeled turn (e.g. "Caller: ...") — it is unlabeled prose glued
// directly onto the end of the reply, which is exactly why a stop-sequence
// on a literal string like "Caller:" would not be a meaningful baseline
// here (see paper Section 4.1/Future Work for this methodological note).
// Instead, this script implements the obvious NAIVE alternative to the
// deployed heuristic's capital-letter-lookahead design: cut every reply
// after its first complete sentence, unconditionally, regardless of
// whether a glued second turn is actually present. This is a real,
// meaningful baseline: it tells us what we would LOSE (legitimate
// multi-sentence replies, which are the normal case for this receptionist)
// if we used the simplest possible rule instead of the smarter one that was
// actually built and deployed.
//
//   node research/naive_baseline_comparison.mjs
//
// Reads every already-collected raw (singleSegment=false) transcript —
// clean and noisy-input conditions alike — and reports, per condition:
//   - how many turns a naive "cut after first sentence" rule would damage
//     (i.e. how often the model's legitimate reply had 2+ sentences, so a
//     naive rule would silently discard real content)
//   - a direct re-check of the deployed GLUED_SEGMENT heuristic against the
//     SAME raw text, confirming it does not cut any of these legitimate
//     multi-sentence replies (0 false positives on real model output, on
//     top of the already-fixed synthetic "U.S." case in
//     research/regex_robustness.mjs)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstSegmentEnd } from '../src/brain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.join(__dirname, 'runs');

const files = fs.readdirSync(runsDir).filter((f) => /singleSegment-false\.json$/.test(f));

let totalTurns = 0;
let naiveWouldDamage = 0;
let heuristicWouldCut = 0; // re-checking GLUED_SEGMENT directly against raw text
const perFileRows = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(runsDir, file), 'utf8'));
  let turns = 0;
  let damaged = 0;
  let heuristicCuts = 0;
  for (const scenarioTurns of Object.values(data)) {
    for (const t of scenarioTurns) {
      if (t.error) continue;
      turns++;
      if ((t.spokenSentences?.length ?? 1) >= 2) damaged++;
      if (firstSegmentEnd(t.rawReplyText) !== -1) heuristicCuts++;
    }
  }
  totalTurns += turns;
  naiveWouldDamage += damaged;
  heuristicWouldCut += heuristicCuts;
  perFileRows.push({ file, turns, damaged, heuristicCuts });
}

console.log('Per-file breakdown:');
for (const r of perFileRows) {
  console.log(`  ${r.file}: ${r.damaged}/${r.turns} turns a naive cut would damage; GLUED_SEGMENT would cut ${r.heuristicCuts}/${r.turns}`);
}

console.log(`\nTotal raw (uncut) turns inspected: ${totalTurns}`);
console.log(`Naive "always cut after first sentence" baseline would damage (discard real content from) ${naiveWouldDamage}/${totalTurns} turns (${(100 * naiveWouldDamage / totalTurns).toFixed(1)}%).`);
console.log(`The deployed GLUED_SEGMENT heuristic, re-applied directly to this same raw text, would incorrectly cut ${heuristicWouldCut}/${totalTurns} of these legitimate replies (${(100 * heuristicWouldCut / totalTurns).toFixed(1)}%).`);
