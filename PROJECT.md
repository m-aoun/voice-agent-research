# Voice Agent Research Paper — Project Memory

Read this file top to bottom to get fully back up to speed. It is the single
source of truth for this project — if anything below conflicts with your own
memory of the conversation, trust this file.

Owner: Muhammad Aoun Shabbir. Just graduated a 3-year "Software Technology"
program (associate/专科 level — Pakistan's IBCC equated it to FSc, not a
Bachelor's, so a full BS is still needed; admitted to St. Cloud State
University as a Bachelor's transfer student, credits/I-20 pending, F1 visa
risk is real; Europe Sept 2027 is the fallback if the visa doesn't work out).
Goal of this paper: a real, citable, indexed publication to strengthen an
MPhil/Master's application abroad later — not a vanity project.

---

## 1. The paper

**Title:** Real-Time Self-Dialogue Hallucination Detection in Cascaded LLM
Voice Agents: A Latency and Reliability Case Study

**RQ1 (latency):** How does a low-cost, self-built cascaded voice pipeline
(STT → LLM → TTS) perform against published enterprise benchmarks?

**RQ2 (reliability / the novel contribution):** How often does the LLM
hallucinate *both sides* of a live call (answers itself, invents what the
caller said), and how well does a lightweight runtime punctuation heuristic
detect/stop it, compared to no detection at all?

### Why this topic (literature grounding — don't re-research this, it's done)
- **arXiv 2603.05413** (Salesforce AI Research, Mar 2026) — "Building
  Enterprise Realtime Voice Agents from Scratch." Same cascade architecture
  (Deepgram STT → LLM → streaming TTS) as our system. Published TTFA = 755ms
  (best 729ms), STT ≈ 337ms. **This is our RQ1 comparison baseline.**
- **arXiv 2508.04721** (2025, telecom voice agents) — ASR 0.05s, TTS 0.28s,
  LLM 0.67s. Second comparison point; shows the LLM dominates the budget.
- **HalluDial (arXiv 2406.07070)** and **DiaHalu (arXiv 2403.00896)** — both
  study LLM self-dialogue hallucination, but *offline*, as a way to *build*
  benchmark datasets — not as a *runtime defense* inside a live system.
  **This is our novelty gap.** HalluDial's metric is accuracy (+ ROUGE-L for
  localization), not precision/recall — match that metric choice for
  credibility.
- **Giga.ai** (company blog, not peer-reviewed) claims they cut voice-agent
  hallucination from 4-5% to <1% in production, detecting in the gap between
  LLM text and speech. Confirms industry already treats this as a real,
  unsolved-in-literature problem. Good framing evidence, not a citable paper.
- **τ-Voice (arXiv 2603.13686)** — brand new full-duplex voice agent
  benchmark, uses the *exact same* G.711 μ-law 8kHz telephony audio format as
  our system. Reports only 26-51% task success under realistic conditions.
  Use its benchmarking methodology as inspiration for RQ1's success-rate
  metric, not just raw latency.
- **IHBench (arXiv 2606.19595, Jun 2026)** — closest work on barge-in/
  turn-taking recovery. Too big to replicate properly now — good "future
  work" paragraph, not in scope.

### Target venue
- **IEEE SERA** (Software Engineering Research, Management and Applications)
  — real precedent found: an undergrad-led ASR paper was accepted there in
  2026 (University of Southern Maine). IEEE Xplore indexed, realistic bar for
  a student co-authored paper.
  **A10 research (2026-11-22):** SERA 2026 (the 24th edition, Towson, MD)
  already happened (May 27-29, 2026) — its submission window is closed, so
  the real target is **SERA 2027, the 25th edition, University of Nevada
  Las Vegas (UNLV), May 26-28, 2027, hybrid (in person & online)**.
  Sourced from the official CFP (easychair.org/cfp/SERA-2027) and the ACIS
  conference page (acisinternational.org/conferences/sera-2027/):
  - **Deadlines found — note a real conflict needing confirmation before
    relying on either:** EasyChair's page header says "Submission deadline:
    March 31, 2027" but its own "IMPORTANT DATES" list AND the ACIS page
    both independently say **full paper submission: February 26, 2027**.
    Treat Feb 26, 2027 as the working deadline (two independent sources
    agree), but double-check on the live CFP closer to the date. Other
    dates: special session/workshop proposals Jan 12, 2027; abstract
    registration (EasyChair only) March 1, 2027; acceptance notification
    April 5, 2027; camera-ready + registration April 19, 2027.
  - **Format:** IEEE conference template (no LaTeX/Word link given on
    either page checked), margins/font size must not be changed. **Full
    papers: up to 8 pages including references. Short papers: up to 4
    pages including references.** Title must be prefixed "SERA2027:" on
    submission (SERA shares a submission system with 3 co-located
    conferences — AIML2027/BCD2027/ICIS2027 — so the prefix picks which
    one).
  - **Portal:** EasyChair (easychair.org/conferences/?conf=sera2027).
  - **Blind review: NOT STATED on either page checked.** Don't assume
    double-blind; don't anonymize the PDF by default. Re-check the CFP PDF
    (CFP_SERA2027.pdf, linked from the ACIS page, not yet fetched) or the
    separate "Paper Submission Instructions" page before actually
    submitting, in case it specifies this.
  - **Publication:** "proceedings will be published by IEEE Conference
    Publishing Services and submitted for indexing in EI, INSPEC, and
    DBLP" (EasyChair's own wording). IEEE Xplore itself isn't explicitly
    named on either page — reasonable to assume given IEEE Conference
    Publishing Services, but not a direct quote, so don't state it to Dr.
    Sadiq as 100% confirmed without one more check.
  - **Attendance/fees:** not clearly stated whether an author must attend
    in person for a non-best-paper submission (the "hybrid" format and an
    "Online Presentation Coordinating Chair" role both suggest remote
    presentation is possible, but this isn't explicit). A linked fee
    schedule PDF and "Register Now" page were both still placeholders
    ("tba") as of this check — revisit closer to the deadline.
  - **Takeaway for timeline:** paper needs to be submission-ready by
    **~Feb 26, 2027** for this specific edition. That's a realistic amount
    of runway from where the draft is now (2026-11-22).
- **arXiv preprint** — do this regardless, immediately once there's a solid
  draft. Zero gatekeeping, free, instant, citable even before/without formal
  peer review.
- Possible journal extension later: **IEEE Access** — Dr. Sadiq already has
  2 papers there, so he'd be comfortable with that specific venue's process.

---

## 2. The co-author: Dr. Muhammad Sadiq

Full profile check done (muhammad-sadiq.com, all pages, + Google Scholar).
Key facts, don't re-research:

- Assistant Professor, Project Director (International Affairs), Foreign
  Technology Expert — Shenzhen University of Information Technology (SUIT).
  Also associated with Shenzhen Research Institute of Big Data / CUHK
  Shenzhen (appointment type unclear from the site).
- Already has a real relationship with Aoun: taught him, was his TA
  supervisor in 3rd year, wrote him a strong unprompted recommendation
  letter. **Directly connected on WeChat — contact is not a bottleneck.**
- Research areas: Computer Vision (occlusion-adaptive facial landmark
  detection — his main line, 2019–2026, incl. CVPR 2019 as co-author, IEEE
  Access, Pattern Recognition, Applied Intelligence) and Cybersecurity/IoT/
  blockchain (IDS, VANET, industrial CPS — Knowledge-Based Systems,
  Engineering Applications of AI, JNCA, GLOBECOM/WCNC).
- **"AI & Trustworthy Intelligent Systems" is a literal named research area
  on his /research page** — frame the paper explicitly as a Trustworthy-AI
  contribution (reliability/safety of a deployed LLM system), not just "cool
  voice bot," and it fits his stated focus directly. No mismatch risk.
- Scale: h-index 15, ~1180 citations, i10-index 21 — a real, solidly
  productive mid-career researcher. Not elite-tier, but legitimate and
  internationally publishing. Verdict already reached: **don't go looking
  for someone else.** A near-certain "yes" from a real, productive professor
  beats a low-probability "maybe" from a bigger name, especially for a first
  publication.
- His /contact page literally says: "Welcome opportunities for joint
  research projects, PhD supervision, and academic partnerships."
- His /team page lists **zero current students** — he's actively looking for
  output/collaborators, which works in our favor.
- Because Aoun is not currently enrolled as a student anywhere (BS not yet
  started), Dr. Sadiq's role is **co-author / senior research collaborator**,
  not formal "supervisor" (supervision is tied to an active degree program).
  This is normal and common — alumni + former professor joint papers happen
  all the time.
- Email: sadiq@sziit.edu.cn. His site's contact form asks for an
  institutional email, so use direct email or WeChat instead.
- Unverified claims on his site (don't cite without checking): "Best Paper
  Award, ICCV 2023" (no paper title given), exact nature of the CUHK
  Shenzhen affiliation.

---

## 3. The real system this paper is built on

Source: `E:\Medical booking test` (AI clinic receptionist demo, split off
from `E:\unit47Digtal-call-engine`). **Do not edit that repo for this
project** — this research repo (`E:\voice-agent-research`) only *reuses*
logic from it, kept fully separate, so:
(a) nothing research-related risks the live business code, and
(b) the paper's public GitHub repo never exposes business internals
    (Twilio account structure, admin dashboard, real client data, etc.)

Real architecture already built and working:
- STT: Deepgram (streaming, mulaw 8kHz, no resampling) — `src/call/stt.js`
- LLM "brain": any OpenAI-compatible endpoint, default OpenRouter →
  Groq-hosted `openai/gpt-oss-20b` — `src/call/brain.js`. **This class is
  pure text-in/text-out, zero dependency on Twilio/Deepgram/DB** — it's
  exactly what RQ2's experiment harness drives directly.
- TTS: Cartesia — `src/call/cartesiaKeyPool.js`, `src/call/voice.js`
- Telephony: Twilio — `src/twilio/`
- The actual mitigation already in production: `singleSegment: true` mode in
  `Brain` detects a glued second turn mid-stream via a punctuation heuristic
  (`firstSegmentEnd` / `GLUED_SEGMENT` regex in `brain.js`) and cuts the
  stream before it reaches the caller. **This is RQ2's subject.** Running the
  same scenario with `singleSegment: false` gives the uncut ground truth to
  score the heuristic against.

### Important real-world fact — don't assume you can recover this
The original production engine (`E:\unit47Digtal-call-engine`) ran on a
Hostinger VPS that **expired/was cancelled** — its database had ~2,700-3,000
real calls from real US leads. That data is gone. Checked the local repo
(2026-11-16) to be sure: `data/unit47.db` exists locally but only has 1 row
each in `leads`/`calls` — it's a near-empty dev copy, not the real dataset.
**Confirmed: no real historical call data to mine. All experiments use
scripted/synthetic caller scenarios instead** (already written, see below).

### Free/local stack decision (already made, don't re-litigate)
Everything is paid in the real world, but we don't need to spend anything:
- **LLM leg:** Ollama, already installed on this machine, models available:
  `llama3:8b`, `qwen2.5:7b`, `deepseek-coder:6.7b`. Reachable at
  `http://localhost:11434/v1/chat/completions` (OpenAI-compatible — confirmed
  reachable 2026-11-16). `Brain`'s `baseUrl`/`model` are both env-overridable
  with **zero code changes needed** to point it at Ollama instead of
  OpenRouter.
- **STT leg (for RQ1 only):** swap Deepgram for local **faster-whisper**
  (already pip-installed, v1.2.1 confirmed). Free, local, reproducible.
- **TTS leg (for RQ1 only):** swap Cartesia for local **Piper TTS** — NOT
  installed yet, needs setup.
- **Small cloud sample for RQ1's direct literature comparison:** a modest
  batch (50-100 calls) of real Deepgram/Groq/Cartesia calls, using free-tier
  credits only — practically $0, but gives a real "commercial stack" number
  to put next to the Salesforce/telecom papers' figures. Use fresh
  research-only API keys, never the live business's `.env`/production keys.
- Bonus framing: report local-Ollama latency as its own third column
  ("self-hosted baseline") next to published-cloud and our-own-cloud — the
  Salesforce paper itself treats self-hosted vLLM as a legitimate condition,
  so this isn't a compromise, it's a real extra comparison point.

---

## 4. The process — who does what

### A — Claude does these (in order)
- [x] **A1.** Set up this research repo properly: `.gitignore`, `LICENSE`
      (MIT), README, `status.html` tracker, public GitHub repo. **Done
      2026-11-16** — github.com/m-aoun/voice-agent-research. (The reused
      `Brain`-class logic, fictional clinic profile only, no business
      secrets, moves into A2 since that's where it's actually used.)
- [x] **A2.** Build the RQ2 experiment harness. **Done 2026-11-16** —
      `src/brain.js` (adapted from the real receptionist pipeline, zero
      business-identifying content) + `research/hallucination_harness.mjs`,
      5 scenarios, test-run against `llama3:8b` end-to-end, zero errors.
      **Finding:** 0/10 turns triggered the self-dialogue cut on this small
      run — A3 needs more models (`qwen2.5:7b` at least) and likely harder/
      longer scenarios to get positive examples to test the heuristic
      against.
- [x] **A3.** Run the harness across all scenarios × models × both modes.
      **Done 2026-11-16.** Expanded to 7 scenarios (added 2 designed to
      provoke rambling), 2 models (`llama3:8b`, `qwen2.5:7b`), 2 temperatures
      (0.4 production-matching, 0.8 stress-test) = 8 full runs, ~52 real
      turns per singleSegment mode, zero errors.
      **Key finding: 0/52 turns triggered the self-dialogue cut, in either
      model, at either temperature, even on scenarios designed to provoke
      rambling.** Manually spot-checked raw (uncut) replies — genuinely
      well-behaved, no self-dialogue invention (one reply did fabricate a
      plausible-but-unverified detail, a *different* hallucination type, not
      the glued-turn pattern). This reframes RQ2: the failure mode may be
      specific to the real production model (`gpt-oss-20b`, a reasoning
      model needing special handling) or to the OpenRouter/Groq serving
      path, not a universal behavior across LLMs. Tried pulling `gpt-oss:20b`
      locally to test this directly — aborted, see §5 errors log (connection
      too slow, 13GB/2+hrs).
      **Decision (2026-11-21, Aoun):** write it as an honest negative/
      boundary result — "we built this heuristic because we saw the problem
      in production, but it doesn't reproduce in general-purpose open
      models" is itself a real, citable finding. Main goal is publishing a
      good paper, not chasing the gpt-oss download further right now. Do
      NOT revisit gpt-oss:20b unless it comes up naturally later — it's not
      blocking anything.
      **Update (2026-11-22) — the production model WAS tested after all,
      via a better path.** Aoun re-shared a Gemini review that suggested
      testing the real production model through a free/cheap cloud API
      instead of the impractical local 13GB download. Aoun supplied an
      OpenRouter API key. First key had a hard $0.00 usage limit ("Key
      limit exceeded (total limit)... $0.00 of $0.00 used") — confirmed via
      direct `curl`, not a code bug. A retry-logic bug in `Brain.respond()`
      had briefly masked this (any retry sets `useDefaultModel=true`, which
      falls back to the Ollama-only default model name `llama3:8b`, invalid
      on OpenRouter — so the real $0-limit error was hidden behind a
      secondary "llama3:8b is not a valid model ID" error on the first
      attempt). Aoun supplied a second key with an explicit $0.50 limit —
      verified working via `curl` first, then ran the full harness:
      `openai/gpt-oss-20b` via OpenRouter, pinned to the Groq provider
      (`provider: { order: ['Groq'] }`) — i.e. the exact real production
      model AND the exact real production serving path. 2 temperatures ×
      2 singleSegment modes × 7 scenarios = 33 additional real turns.
      **Result: 0/33 additional triggers — RQ2 total is now 0/85 across
      three models.** Manually spot-checked raw replies: the production
      model was, if anything, more conservative than the local models
      (e.g. said "I don't have that specific information" rather than
      fabricating a physician's name). Real cost incurred: a few cents,
      well under the $0.50 limit. `research/analyze_results.mjs` updated
      to generically match any `<model>__temp-X__singleSegment-Y.json` file
      instead of a hardcoded two-model list, and `research/RESULTS.md`
      regenerated to confirm 0/85. `paper/paper.md` updated throughout
      (Abstract, Methodology, Results, Discussion's new binomial-statistics
      paragraph, Threats to Validity, Future Work, Conclusion) to reflect
      three models and 85 turns, and the paper's earlier blanket "fully
      free / zero cost / no paid API calls" claims corrected to
      "predominantly free... one exception... negligible cost" since they
      became false once this test was added. This closes what had been the
      paper's single biggest acknowledged limitation.
- [x] **A4.** Install Piper TTS locally; build a local STT+LLM+TTS
      instrumented pipeline. **Done 2026-11-21.** `pip install piper-tts`,
      downloaded `en_US-amy-medium` voice (~63MB). Built
      `research/stt_tts_server.py` — a warm local HTTP server (faster-whisper
      + Piper loaded once) so latency measurements reflect real per-call
      inference time, not one-time model load. Hit a real error here, see §5.
- [x] **A5.** Run RQ1 latency experiments on the local stack. **Done
      2026-11-21.** `research/rq1_latency_harness.mjs` measures STT, LLM
      time-to-first-token, LLM time-to-first-sentence, and TTS separately,
      per turn, across `llama3:8b` and `qwen2.5:7b` (10 turns each + 1
      discarded warm-up turn to exclude Ollama's cold-load cost). Real
      results (p50 / p90, milliseconds):

      | | STT | LLM first-token | LLM first-sentence | TTS | Total |
      |---|---|---|---|---|---|
      | llama3:8b | 939 / 1197 | 1199 / 1583 | 10732 / 13188 | 197 / 390 | 11657 / 14553 |
      | qwen2.5:7b | 1024 / 1204 | 1138 / 1495 | 7572 / 9825 | 254 / 370 | 8830 / 11280 |

      **Comparison to literature (PROJECT.md §1):** vs Salesforce's 755ms
      TTFA and the telecom paper's STT=50ms/LLM=670ms/TTS=280ms —
      - STT: 3-20x slower (CPU batch faster-whisper vs GPU streaming
        Deepgram — expected).
      - **LLM time-to-first-token is only ~1.5-2.4x slower than cloud**
        (1.1-1.6s vs 0.67s) — closer than expected, suggests the T1200 GPU
        is meaningfully helping even at just 4GB VRAM.
      - **LLM time-to-first-SENTENCE is the real bottleneck** (7.5-10.7s) —
        once generation starts, sustained tokens/sec is far behind
        Groq-class specialized inference hardware. This is the honest
        explanation for why production voice systems lean on providers like
        Groq even when using open-weight models: the gap isn't in starting
        to generate, it's in how fast tokens keep coming after that.
      - TTS: 197-390ms — competitive with cloud TTS (100-280ms). Piper is a
        genuinely good free/local choice for this leg specifically.
- [x] **A6.** **Done 2026-11-21.** Built `research/analyze_results.mjs` —
      reads all raw `research/runs/*.json` files and generates
      `research/RESULTS.md` programmatically (no hand-transcription, so no
      copy errors). Confirms: RQ2 = 0/52 turns triggered, RQ1 tables exactly
      match the numbers already in the A5 entry above. `research/RESULTS.md`
      is now the single source of truth A7 draws its numbers from. The
      cloud sample (A11) below only adds one extra comparison column later
      — not needed to finish the paper.
- [x] **A7.** **Done 2026-11-21 — first full draft.** `paper/paper.md`:
      Abstract, Intro, Related Work (all 7 citations from §1), System
      Description, Methodology, Results (both tables straight from
      `research/RESULTS.md`), Discussion, Limitations, Future Work,
      Conclusion, References, reproducibility statement. Author list has
      Dr. Sadiq as a bracketed placeholder — not finalized until he agrees
      (see A8). **Needs Aoun's read-through (B2) before anything goes to
      Dr. Sadiq** — Claude wrote the full draft but a second pair of eyes on
      the honesty/accuracy of every claim matters more here than anywhere
      else in this project.
- [x] **A8.** **Done 2026-11-22.** `paper/outreach_message_dr_sadiq.md` —
      warm, low-pressure WeChat message. References his "Trustworthy AI"
      focus specifically, makes clear Aoun isn't asking for formal
      supervision (not currently enrolled), links straight to the repo,
      gives Aoun notes on tone/splitting it up before sending. **Next: B4
      — Aoun sends it whenever ready, then relays his response back.**
- [x] **A9.** **Done 2026-11-22.** Prepped the repo for publication:
      - Scanned the full git history (`git log --all -p | grep`) for any
        accidentally committed API key patterns (OpenRouter's `sk-or-v1-...`
        specifically, plus generic key-shaped strings) — **confirmed clean,
        zero matches across all 11 commits.** Both OpenRouter keys used
        this session were ephemeral shell env vars only, never written to
        any file.
      - `README.md` updated: fixed the now-inaccurate "fully free... no
        paid API required" claim to match the real state (predominantly
        free, one paid exception for the production-model RQ2 condition,
        a few cents real cost); added the OpenRouter/Groq reproduction
        command (verified against what `hallucination_harness.mjs` and
        `brain.js` actually read from env vars, not just written from
        memory); linked directly to `paper/paper.md` and
        `research/RESULTS.md`; added the `analyze_results.mjs` regen
        command.
      - `src/brain.js`: added a documentation-only comment on the
        known-but-real retry-logic footgun (any retry silently falls back
        to the Ollama-default model name unless `LLM_MODEL` is set) —
        **did not change the actual logic**, since this file's header
        explicitly claims to be "unmodified-in-logic" from the real
        production class, and the bug is irrelevant to what RQ2 studies
        (the `GLUED_SEGMENT` heuristic), so documenting it beats silently
        changing reused production code.
      - Blind-review policy check deferred to A10's findings below — not
        stated by SERA 2027's CFP, so no author-anonymization change made;
        revisit before actual submission once confirmed.
      - `LICENSE` (MIT), `.gitignore`, `package.json` all already fine,
        no changes needed.
- [x] **A10.** **Done 2026-11-22.** Researched SERA's real, current
      submission requirements — see §1 "Target venue" above for full
      details (dates, deadlines incl. a noted conflict, page limits,
      template, portal, blind-review status, publication/indexing). Key
      takeaway: **SERA 2026 already happened; the real target is SERA
      2027 (UNLV, May 26-28 2027), full-paper deadline ~Feb 26, 2027.**
- [x] **A11 — CANCELLED (Aoun, 2026-11-22).** Was: once Aoun hands over
      fresh free-tier Deepgram/Groq-OpenRouter/Cartesia keys, run a small
      batch (50-100 calls) through the real cloud stack and add that as a
      single comparison column to the paper. Aoun pointed out the
      OpenRouter key he'd already given (used for A3's update) could cover
      the LLM leg — asked whether to do a partial version with just that.
      Claude's advice, which Aoun accepted: **skip it entirely**, don't do
      the partial version either. RQ1 already has a legitimate comparison
      (this work's local-stack numbers against the published literature's
      cloud figures — Salesforce, the telecom paper); a live cloud-stack
      replication would mostly re-confirm already-published numbers for a
      modest sample, not worth the added time against the real goal of
      getting the paper submission-ready. The partial/hybrid option (cloud
      LLM only, local STT/TTS) was actively rejected as scientifically
      messy — a condition that doesn't match anything else in the paper
      and is hard to interpret cleanly. **Removed from status.html.**

### B — Aoun does these
- [ ] **B1 (revised after A3's finding).** Original plan was hand-labeling
      transcripts for self-dialogue vs legitimate replies — but A3 found
      0/52 turns had any self-dialogue, so there's nothing to label in the
      traditional sense (no positive/negative split to score against).
      Lighter version instead: spot-check maybe 10-15 of the raw transcripts
      in `research/runs/*.json` to independently confirm Claude's own read
      ("genuinely clean, not a missed detection") — a quick sanity check,
      not exhaustive labeling. Not blocking — can happen whenever Aoun has a
      few minutes.
- [x] **B2 (delegated back to Claude, 2026-11-22).** Aoun said "I don't
      need to read it, you read it — just make sure it's heavy enough to
      actually get accepted." Claude did a genuinely critical self-review
      (not a rubber stamp) plus a full web novelty check — see A7's
      strengthening commit. Aoun can still read `paper/paper.md` at any
      point and flag anything, this isn't a permanent waiver.
- [x] **B3 — CANCELLED (2026-11-22), same decision as A11.** Was: create
      fresh, research-only Deepgram / Groq or OpenRouter / Cartesia
      free-tier accounts for the cloud-API comparison sample. No longer
      needed since A11 itself was cancelled.
- [ ] **B4.** Send the outreach message to Dr. Sadiq on WeChat once A8 is
      ready, and relay his response back.
- [ ] **B5.** Handle the IEEE SERA submission portal / account / ORCID
      linking personally when we actually submit.
- [ ] **B6.** (Separate track, not blocking this project) Keep handling the
      St. Cloud State I-20 / F1 visa process on his own timeline.

### C — Joint, once Dr. Sadiq is on board
- [ ] **C1.** Share the draft + real results with him for review as
      co-author.
- [ ] **C2.** Incorporate his feedback (methodology, extra citations he may
      know, his own read on the right venue given his publishing experience).
- [ ] **C3.** Finalize author order and affiliations, submit together.
- [ ] **C4.** Respond to peer-review comments together if/when it goes out
      for review.

---

## 5. Installed / created for THIS project — track for later cleanup

Rule: whatever gets installed, downloaded, cached, or newly created on this
machine specifically because of this project gets logged here — including
errors hit along the way (so we don't repeat the same dead end) and disk
space used. **This log is strictly for `E:\voice-agent-research` — never mix
in anything from the business repos or unrelated projects.** Once the paper
is done, walk this list top to bottom and delete whatever's marked "cleanup
after project."

Update this table every time something new gets installed/created —
don't let it go stale.

| Item | Added when | Disk cost | Pre-existing or new? | Cleanup after project? |
|---|---|---|---|---|
| `E:\voice-agent-research\` folder + `PROJECT.md` | 2026-11-16 | ~20KB | New | No — this is the deliverable itself |
| Ollama models (`llama3:8b`, `qwen2.5:7b`, `deepseek-coder:6.7b`) | already present before this project | ~14GB total | **Pre-existing** — not installed for this project, don't delete on cleanup, they're shared/general-purpose | No |
| `faster-whisper` (pip package) | already present before this project | small | **Pre-existing** | No |
| `piper-tts` (pip) + `pathvalidate` dep | 2026-11-21 | ~34MB wheel | New, for this project | **Yes** — `pip uninstall piper-tts pathvalidate` |
| `en_US-amy-medium` Piper voice model | 2026-11-21 | ~63MB, in `models/piper/` (committed to git — it's a published open-source voice model, no license issue, and needed for anyone to reproduce the experiment) | New, for this project | No — part of the reproducible artifact, keep it |
| `faster-whisper`'s cached `base.en` model (HuggingFace cache, `~/.cache/huggingface/`) | 2026-11-21 | ~145MB | New, for this project (the pip package was pre-existing, this cached model download is not) | **Yes** — safe to delete from the HF cache after the paper's done, if not reused elsewhere |
| `node_modules` inside `E:\voice-agent-research\` (once `npm install` runs) | not yet created — coming in A1/A2 | TBD | New | **Yes — delete the whole project folder's node_modules, or the folder entirely, once done, if not needed anymore** |
| Experiment run logs (`research/runs/*.json`) | created in A3 (2026-11-16) | small (text), all committed to git | New | No — keep, this is the actual experimental data for the paper |
| `gpt-oss:20b` Ollama model pull (the real production model) | attempted 2026-11-16, **aborted** | 0GB (was going to be ~13GB) | N/A — never completed | Already cleaned up — see errors log |
| OpenRouter API key (Aoun's own, $0.50 limit) | used 2026-11-22 | ~$0.01-0.05 of real spend (well under the $0.50 limit) — the only non-zero cost in this entire project | New, for this project — used only as an ephemeral shell env var, never written to any file or committed | No further cleanup needed — key was never persisted anywhere, nothing to delete |
| `research/runs/openai_gpt-oss-20b__temp-{0.4,0.8}__singleSegment-{true,false}.json` (4 files) | created 2026-11-22 | small (text), committed to git | New | No — keep, real experimental data |

Errors log (append here as they happen, don't lose this context):
- **2026-11-16 — `gpt-oss:20b` pull aborted.** Tried pulling the actual
  production model (an open-weights release, confirmed available in
  Ollama's library) to test the exact same model used in the real system.
  Download speed was ~1.8MB/s → ETA 2+ hours for the 13GB model, impractical
  for this session. Killed the pull process (PID had to be found via
  `Get-Process ollama` and stopped directly — `ollama rm` didn't work since
  the manifest never finished, so the partial blob was orphaned). Deleted
  the 13GB partial blob file from `~/.ollama/models/blobs/` to reclaim disk
  space — confirmed back to the pre-existing ~12GB total after cleanup, and
  the Ollama server (a separate process) kept running fine throughout.
  **Revisit this later if/when on a faster connection** — it would let RQ2
  test the actual production model locally instead of only comparable
  general-purpose models.
- **2026-11-21 — `faster-whisper` + PyAV incompatible on this Python
  version.** `model.transcribe('file.wav')` threw
  `TypeError: open() got an unexpected keyword argument 'metadata_errors'`
  — faster-whisper 1.2.1's `decode_audio()` calls `av.open(..., metadata_errors=...)`,
  a kwarg the installed PyAV 19.0.2 removed. Tried downgrading
  (`pip install av==12.3.0`) since that's the usual fix — **failed**, no
  prebuilt wheel exists for Python 3.14 below 19.x, and building from source
  failed (no local FFmpeg dev headers on this machine). Reinstalled
  `av==19.0.2` to get back to a working state.
  **Real fix:** don't go through `av` at all — decode the WAV ourselves
  with the stdlib `wave` module into a numpy float32 array and hand that
  directly to `model.transcribe()` (it accepts a raw array, not just a file
  path). Implemented in `research/stt_tts_server.py`. **Don't attempt the
  PyAV downgrade again on this machine — it won't work, this is the
  permanent workaround.**
- **2026-11-21 — Ollama server died silently.** After the gpt-oss:20b pull
  was killed (see above), the Ollama HTTP server (a separate process) was
  also down (`curl` → connection refused) by the time the RQ1 harness ran,
  for reasons the tool didn't fully pin down — it survived the pull-kill
  fine right after it happened, but had stopped by the time this session
  resumed. Fix: `ollama serve` restarts it in a few seconds. If a harness
  run fails with `ECONNREFUSED` to `localhost:11434`, check this first
  before assuming a code bug.
- **2026-11-22 — first OpenRouter key had a $0.00 usage limit, briefly
  masked by an unrelated retry-logic bug.** Full harness run against
  `openai/gpt-oss-20b` via OpenRouter failed with
  `LLM 400: ...llama3:8b is not a valid model ID` — looked like a config
  bug at first. Root cause via direct `curl` with the identical payload:
  the key itself had "Key limit exceeded (total limit)... $0.00 of $0.00
  used" — an account/key issue, not a code bug. The confusing
  `llama3:8b`-not-valid error was a side effect of `Brain.respond()`'s
  retry logic: any retry (even for an unrelated transient error) sets
  `useDefaultModel=true`, and the fallback model name is
  `llmConfig.model`, hardcoded to Ollama's `'llama3:8b'` default unless
  `LLM_MODEL` is set — invalid on OpenRouter, so the retry's own failure
  masked the real original error. Not yet fixed in `brain.js` (noted as a
  real but low-priority footgun — only matters when testing against a
  non-Ollama endpoint without `LLM_MODEL` set). Resolved by Aoun supplying
  a second key with an explicit $0.50 limit, verified working via `curl`
  before rerunning the full harness.

## 6. Machine specs (checked 2026-11-16 — no bottleneck expected)

This machine runs the whole free/local stack comfortably:
- **CPU:** Intel i7-11850H, 8 cores / 16 threads @ 2.5GHz
- **RAM:** 32GB
- **GPU:** NVIDIA T1200 Laptop GPU, 4GB VRAM, driver 595.95, CUDA 13.2 —
  confirmed working via `nvidia-smi`, idle and ready. Enough to run
  Q4-quantized 7-8B Ollama models with GPU acceleration (some layers may
  offload to RAM if a model needs more than 4GB VRAM — normal, just slightly
  slower, not a failure).
- **Disk:** 272GB free on E: — plenty of room.
- **OS:** Windows 11 Pro.
- **Already installed, confirmed working:** Ollama 0.32.3 (models
  `llama3:8b`, `qwen2.5:7b`, `deepseek-coder:6.7b` already downloaded, OpenAI
  endpoint confirmed reachable at `localhost:11434/v1/`), `faster-whisper`
  1.2.1 (pip), Node.js v24.11.1.
- **Still needs installing:** Piper TTS (for A4).

## 7. Time & resource estimate

Active Claude work-hours per task (spread across sessions — not one sitting):

| Task | Est. time | What it actually uses |
|---|---|---|
| A1 — repo setup | ~30 min | Git, folder structure, LICENSE, README |
| A2 — RQ2 harness | ~1.5 hr | Node.js, reused `Brain` class, Ollama endpoint |
| A3 — run RQ2 experiments | ~45 min | Ollama (`llama3:8b`, `qwen2.5:7b`) on this GPU — ~90 total conversation turns, a few seconds each |
| A4 — Piper install + local pipeline | ~1 hr | Piper TTS install, `faster-whisper`, wiring to `Brain` |
| A5 — RQ1 local latency run | ~1.5 hr | faster-whisper + Ollama + Piper, instrumented timestamps |
| A6 — analysis | ~1 hr | Plain data analysis over the JSON logs from A3/A5 |
| A7 — paper draft | ~3 hr | Writing, using the literature already gathered in §1 |
| A8 — outreach message draft | ~20 min | Writing |
| A9 — GitHub repo prep | ~40 min | Git, README, LICENSE, blind-review check |
| A10 — IEEE SERA requirements research | ~40 min | Web research |
| **Total (A1-A10, my active time)** | **~11 hours**, realistically 3-5 separate sessions | — |

**Real bottleneck to know about:** this isn't all my time. **B1 (Aoun
hand-labeling the ~90 transcript turns from A3)** sits between A3 and A6 and
blocks A6 from finishing — that's maybe 1-2 hours of Aoun's own focused time,
and it happens on his schedule, not mine. A11 (the deferred cloud-API
comparison) similarly waits on B3 (Aoun creating free-tier accounts) whenever
that happens — no rush, it's not on the critical path.

## 8. Status

**Current status (2026-11-22): A1-A8 done, plus a second strengthening
pass after external review, plus a third update after actually testing
the real production model.** Public GitHub repo live at
github.com/m-aoun/voice-agent-research.

**Biggest update since the last status note:** acted on the Gemini
review's suggestion to test the real production model (`openai/gpt-oss-20b`
via OpenRouter → Groq) instead of leaving it as an untested limitation.
After a $0-limit key diagnosis (see A3's update above and the errors log),
Aoun's second key (working, $0.50 limit) let the full harness run for real:
**0/33 additional triggers, bringing RQ2's total to 0/85 across three
models — the single biggest limitation the paper previously acknowledged
is now closed.** `paper.md` fully updated for consistency (Abstract,
Methodology, Results, Discussion's new binomial-probability paragraph,
Threats to Validity, Future Work, Conclusion), including correcting the
paper's own earlier blanket "zero cost" claims to "predominantly free,
one real-but-negligible-cost exception" now that this test exists.

Aoun shared a Gemini review of the draft. Treated it as untrusted input to
verify, not as ground truth — checked every factual claim before acting:
- **Confirmed and fixed:** citation [1]'s model name (Qwen2.5-Omni) was
  accurate for v1 of that arXiv paper specifically but the paper now notes
  the version explicitly, since v2 reports different figures (Qwen3-Omni,
  146s local).
- **Confirmed real and serious, then fixed properly:** Gemini's regex
  false-positive concern (does `GLUED_SEGMENT` misfire on abbreviations
  like "Dr.Smith"?) was genuinely valid — tested it directly
  (`research/regex_robustness.mjs`, 10 deterministic cases, no LLM). Found
  two real false-positive categories, the more serious being **any
  multi-letter all-capital dotted abbreviation ("U.S.", "U.K.", etc.) —
  the trigger is inside the abbreviation itself, not a spacing issue.**
  Turned this into a proper paper addition: new Methodology subsection
  (4.1), new Results subsection (5.1), a 4th contribution in the
  Introduction, and a concrete low-risk fix recommendation in Future Work.
  This is a genuinely stronger paper for having found it.
- **Had to correct my own earlier mistake:** my citation [10]
  (`voice-latency-lab`) had wrong secondhand numbers (I'd said
  ~250-270ms/~4x faster; verified-via-direct-fetch real numbers are 70ms
  first-token / 13.6-15.9x faster, using a *larger* model than ours). Fixed
  throughout Related Work, Discussion, and Threats to Validity — the
  corrected, larger gap is actually a more interesting finding (points at
  memory architecture, not model size, as the dominant factor).
- Re-verified the repo itself exists (it does — public, MIT, 9 commits,
  0 stars, real README) before leaving any citation to it in the paper.

A9 and A10 are now also done (2026-11-22): the repo is publication-ready
(git history scanned clean of secrets, README corrected and expanded,
a real-but-irrelevant-to-the-heuristic bug in `brain.js` documented
rather than silently changed), and the real target venue/deadline is
confirmed — **SERA 2027 at UNLV, full-paper deadline ~Feb 26, 2027**
(SERA 2026 already happened). Full details in §1 and in A9/A10 above.

A11/B3 (the deferred cloud-API comparison sample) were **cancelled**
the same day, by Aoun's decision on Claude's advice — RQ1's existing
comparison against published literature figures is legitimate on its
own, and a live cloud-stack replication (or worse, a partial hybrid
using just the OpenRouter LLM leg Aoun had already supplied a key for)
wasn't worth the added complexity against the goal of getting the paper
submission-ready soon.

**Next action: B4 — Aoun sends the outreach message whenever ready, then
relays Dr. Sadiq's response back.** That's the only task left in the
entire project that isn't done, cancelled, or on Dr. Sadiq's own timeline
(B1/B5/B6 are optional or far downstream). Check `status.html` for the
live-updated task-by-task picture.
