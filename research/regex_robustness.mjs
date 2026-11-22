// Deterministic robustness check for the GLUED_SEGMENT heuristic
// (firstSegmentEnd() in src/brain.js). No LLM involved — this tests the
// regex itself against hand-constructed sentences, to check whether
// ordinary front-desk language could produce a false positive (the
// heuristic cutting a perfectly well-formed reply).
//
//   node research/regex_robustness.mjs
//
// Each case also carries `correct`: true means the expected behavior below
// IS what a correct heuristic should do; false means the expected behavior
// is a documented, still-present bug we expect to see (not a passing grade
// for the heuristic — a passing grade for this script accurately predicting
// known behavior).

import { firstSegmentEnd } from '../src/brain.js';

const CASES = [
  // [text, expected ('safe' = should NOT cut, 'cut' = should cut), note, correct]
  ['Dr. Smith will see you now.', 'safe', 'common abbreviation, properly spaced', true],
  ['Dr.Smith will see you now.', 'cut', 'KNOWN, UNFIXED false positive: abbreviation with no following space — not distinguishable from a genuine glued turn using punctuation alone', false],
  ['We are located in the U.S. Give us a call.', 'safe', 'FIXED (was a false positive): multi-letter dotted abbreviation — the internal period in "U.S." is now recognized and excluded', true],
  ['We ship to the U.K. Delivery takes 3 days.', 'safe', 'FIXED: same abbreviation-run pattern, different abbreviation', true],
  ['Their office is in the U.S.A. Call anytime.', 'safe', 'FIXED: three-letter abbreviation run (two internal periods) still handled', true],
  ['Your visit is covered under Blue Cross Inc. We will confirm.', 'safe', 'company suffix, properly spaced', true],
  ['The fee is $50, e.g. for a standard visit.', 'safe', 'lowercase abbreviation — lookahead requires a capital letter', true],
  ['See Dr. Patel on Tuesday.', 'safe', 'common real receptionist phrase', true],
  ['Please arrive by 9 a.m. Monday is fine too.', 'safe', 'a.m. + space + capital', true],
  ['Mr. Khan called earlier.', 'safe', 'single-letter-prefix abbreviation, spaced', true],
  ['St. Mary clinic is nearby.', 'safe', 'St. abbreviation, spaced', true],
  ['Is that okay?Great, see you then.', 'cut', 'TRUE POSITIVE: genuine glued turn, no space (the pattern this heuristic exists to catch) — still correctly caught after the fix', true],
];

let matchedExpectation = 0;
let correctBehavior = 0;
let correctTotal = 0;
for (const [text, expected, note, correct] of CASES) {
  const cut = firstSegmentEnd(text);
  const got = cut === -1 ? 'safe' : 'cut';
  const ok = got === expected;
  if (ok) matchedExpectation++;
  if (correct) {
    correctTotal++;
    if (ok) correctBehavior++;
  }
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${correct ? 'should be correct' : 'KNOWN BUG, expected'}] ${note}`);
  console.log(`     "${text}"`);
  console.log(`     expected=${expected} got=${got}${got === 'cut' ? ` (cut at "${text.slice(0, cut)}")` : ''}`);
}
console.log(`\n${matchedExpectation}/${CASES.length} matched the documented expectation (this script's own sanity check — it should always be ${CASES.length}/${CASES.length}, including the one still-known bug).`);
console.log(`${correctBehavior}/${correctTotal} of the cases where correct behavior is possible now behave correctly (1 case, "Dr.Smith" — missing space after an ordinary abbreviation — is deliberately excluded from this count: it's a known, documented, unfixed limitation, not fixable from punctuation alone, and not claimed as fixed here).`);
