// Deterministic robustness check for the GLUED_SEGMENT heuristic
// (firstSegmentEnd() in src/brain.js). No LLM involved — this tests the
// regex itself against hand-constructed sentences, to check whether
// ordinary front-desk language could produce a false positive (the
// heuristic cutting a perfectly well-formed reply).
//
//   node research/regex_robustness.mjs

import { firstSegmentEnd } from '../src/brain.js';

const CASES = [
  // [text, expected ('safe' = should NOT cut, 'cut' = should cut), note]
  ['Dr. Smith will see you now.', 'safe', 'common abbreviation, properly spaced'],
  ['Dr.Smith will see you now.', 'cut', 'FALSE POSITIVE RISK: abbreviation with no following space'],
  ['We are located in the U.S. Give us a call.', 'cut', 'FALSE POSITIVE: multi-letter dotted abbreviation — the trigger is the period INSIDE "U.S.", not the spacing after it'],
  ['Your visit is covered under Blue Cross Inc. We will confirm.', 'safe', 'company suffix, properly spaced'],
  ['The fee is $50, e.g. for a standard visit.', 'safe', 'lowercase abbreviation — lookahead requires a capital letter'],
  ['See Dr. Patel on Tuesday.', 'safe', 'common real receptionist phrase'],
  ['Please arrive by 9 a.m. Monday is fine too.', 'safe', 'a.m. + space + capital'],
  ['Mr. Khan called earlier.', 'safe', 'single-letter-prefix abbreviation, spaced'],
  ['St. Mary clinic is nearby.', 'safe', 'St. abbreviation, spaced'],
  ['Is that okay?Great, see you then.', 'cut', 'TRUE POSITIVE: genuine glued turn, no space (the pattern this heuristic exists to catch)'],
];

let pass = 0;
for (const [text, expected, note] of CASES) {
  const cut = firstSegmentEnd(text);
  const got = cut === -1 ? 'safe' : 'cut';
  const ok = got === expected;
  if (ok) pass++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${note}]`);
  console.log(`     "${text}"`);
  console.log(`     expected=${expected} got=${got}${got === 'cut' ? ` (cut at "${text.slice(0, cut)}")` : ''}`);
}
console.log(`\n${pass}/${CASES.length} matched the documented expectation (both the real false-positive cases and the real true-positive case are EXPECTED to be flagged — this script documents the heuristic's known behavior, it does not claim the heuristic is bug-free).`);
