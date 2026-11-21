# Real-Time Self-Dialogue Hallucination Detection in Cascaded LLM Voice Agents: A Latency and Reliability Case Study

**Authors:** Muhammad Aoun Shabbir¹, [second author — name withheld here
until co-authorship is confirmed]²

¹ Independent researcher
² Affiliation to be added if/when co-authorship is confirmed.

**Draft status:** working draft, not yet submitted anywhere. All results in
this draft are real, reproducible, and generated from the code and data in
this repository (`research/runs/*.json`, regenerable via
`research/analyze_results.mjs` → `research/RESULTS.md`).

---

## Abstract

Cascaded speech-to-text (STT) → large language model (LLM) → text-to-speech
(TTS) pipelines are the dominant architecture for real-time voice agents in
production use today. Two operational concerns recur in this setting: (1)
end-to-end latency, which governs whether a call feels natural, and (2) a
specific LLM failure mode we call *self-dialogue hallucination*, in which the
model continues a conversation on the caller's behalf — answering its own
question, inventing what the caller said — producing a reply that, left
unchecked, would be spoken aloud as if the caller had actually said those
things. We study both concerns using a real, working AI phone-receptionist
system's production code. RQ1 and most of RQ2 run entirely on a free,
local stack (Ollama, faster-whisper, Piper); one additional RQ2 condition
uses the real production model via its real production provider
(`openai/gpt-oss-20b` via OpenRouter, pinned to Groq), at a real but
negligible cost (~\$0.002 total for 66 API calls). For latency (RQ1, n=30
turns per model), we
find our local time-to-first-token is only 1.4-1.7x slower than published
cloud figures despite running on a 4GB consumer laptop GPU, but sustained
token throughput (time-to-first-complete-sentence) is the dominant cost,
6.2-7.4 seconds at the median —
the real gap between a free/local stack and specialized inference providers
like Groq is throughput, not startup latency. For reliability (RQ2), we
evaluate a lightweight, already-deployed runtime heuristic
(`GLUED_SEGMENT`) that detects and truncates self-dialogue mid-stream before
it reaches the caller. Across 85 scripted conversational turns spanning
**three** models — two general-purpose open-weight models run locally, and
the actual production model run through its actual production provider —
and two temperature settings, we find **zero** instances of the failure
mode the heuristic was built to catch. Critically, this null result holds
even for the exact model and serving path the heuristic was originally
built to defend against, which rules out "wrong model" as the explanation
and instead raises a different, more interesting possibility: the failure
mode may simply be rare, occurring at a low enough rate that 85 trials is
not yet enough to reliably observe it, rather than absent. Combined with
manual verification that our zero observations are true negatives (not
missed detections), we report this honestly as a boundary condition on the
heuristic's necessity, not a positive validation of its accuracy. We
additionally run a small, deterministic robustness check directly against
the heuristic's matching rule (no LLM involved) and find a concrete,
previously-undocumented false-positive risk: certain realistic front-desk
phrases — specifically, multi-letter all-capital abbreviations like
"U.S." — can trigger a false cut regardless of spacing, independent of
whether any self-dialogue is present. We discuss both findings'
implications for treating LLM voice agents as *trustworthy AI systems* in
practice, including a concrete low-risk fix for the false-positive issue.

---

## 1. Introduction

Voice agents built on large language models are moving from demos to
production customer-facing systems: AI receptionists, outbound sales
callers, support triage bots. The dominant architecture remains the
*cascaded* pipeline — a streaming STT service transcribes the caller's
speech, an LLM generates a text reply, and a TTS service speaks it back —
rather than end-to-end speech-to-speech models, because the cascade remains
faster and more controllable for real-time use [1].

Two properties of this architecture matter operationally. First,
**latency**: humans expect a response within a few hundred milliseconds of
finishing a sentence, or the interaction feels broken [1], [2]. Second,
**reliability**: an LLM embedded in a live, user-facing loop can fail in
ways specific to that setting. One such failure, which we call
*self-dialogue hallucination*, occurs when the model's streamed output
continues past a single conversational turn — effectively answering itself,
or inventing the next thing the caller would say — because nothing in a
standard chat-completion request structurally prevents it from doing so.
In a text chat interface this is a cosmetic bug; in a live phone call, where
every token the model emits is converted to audio and played to a real
person, it is a direct trust failure: the system may speak words the caller
never said, attributed to them.

This paper studies both properties using the real, working code of a
production-adjacent AI phone-receptionist system (Section 3), rather than a
toy reimplementation. The system already includes a deployed, lightweight,
regex-based runtime defense against self-dialogue hallucination — a
pragmatic engineering response to a problem observed in real call
transcripts, not a research artifact built after the fact. This gives us an
unusual opportunity: we can evaluate a production mitigation technique
against literature that, as far as we have found, only studies this failure
mode offline, as a method for *constructing* hallucination benchmarks
[3], [4], never as something detected and acted on inside a live generation
stream.

We run nearly every experiment on a fully free, local software stack —
Ollama for the LLM, faster-whisper for STT, Piper for TTS — so that almost
every number in this paper is independently reproducible by any reader at
zero monetary cost. The one exception, described in Section 4.1, is a
direct test against the actual production model through its actual
production provider, at a real but negligible cost (under \$0.01). All code
is published alongside this paper.

Our contributions:
1. A real-world latency characterization of a free/local cascaded voice
   pipeline, broken into STT, LLM time-to-first-token, LLM
   time-to-first-complete-sentence, and TTS, compared against two recent
   published cloud benchmarks [1], [2].
2. An evaluation of a production self-dialogue-hallucination defense
   across **three** models — two general-purpose open-weight LLMs and,
   critically, the actual production model run through its actual
   production provider — two temperature settings, and seven realistic
   front-desk conversational scenarios (85 turns total), reported as a
   negative result with manual verification that it is a true negative
   rather than a missed detection, and a statistically-grounded discussion
   of what a null result over ~85 trials does and does not rule out for a
   potentially rare failure mode.
3. A deterministic robustness check of that same defense's matching rule,
   independent of any LLM, which surfaces a concrete, previously
   undocumented false-positive risk (certain all-capital dotted
   abbreviations) and a correspondingly concrete, low-risk fix.
4. A fully open, zero-cost, reproducible experimental artifact — code,
   scripts, and raw result data — released alongside this paper.

## 2. Related Work

**Cascaded voice agent latency.** Salesforce AI Research [1] presents a
technical tutorial for building self-hosted, enterprise-grade real-time
voice agents, arguing that native speech-to-speech models remain too slow
for real-time use — v1 of the paper reports ~13s time-to-first-audio for
Qwen2.5-Omni; a later revision reports a local Transformers deployment of
Qwen3-Omni at ~146s, with only a cloud-API route (~702ms) being fast
enough to be usable, which does not change the paper's conclusion but is
worth flagging since we are citing a specific figure from v1 here — and
that the cascaded STT → LLM → TTS pipeline, with overlapping execution
between stages, is the practical architecture for production. Both
versions agree on their own built system's core figures, which is what we
actually compare against for RQ1: a time-to-first-audio (TTFA) of 755ms
(best-case 729ms) using Deepgram streaming STT, a self-hosted or
API-served LLM, and ElevenLabs streaming TTS, with a reported STT
component latency of ~337ms.
A second measured pipeline, targeting telecommunications use cases [2],
reports a per-component breakdown of ASR at 0.05s, TTS at 0.28s, and LLM
generation averaging 0.67s — notably showing the LLM, not STT or TTS, as
the dominant latency cost in a cloud-served cascade. We adopt both as our
primary comparison points for RQ1.

**LLM dialogue hallucination.** HalluDial [3] and DiaHalu [4] both
construct large benchmarks for dialogue-level hallucination, and both do so
by having models converse with themselves or with each other under
controlled prompting, then having the resulting transcripts labeled for
hallucination. This is methodologically close to our RQ2 setting — both
also involve an LLM's output diverging from what a real other party said —
but the framing is entirely different: in HalluDial and DiaHalu, the
self-dialogue is the *method* for generating evaluation data, not a failure
being guarded against in a live system. We are not aware of published work
that studies self-dialogue as an unwanted runtime failure mode in a
deployed conversational voice agent, nor of a published technique for
detecting and truncating it mid-stream before it reaches a user. A
commercial voice-AI company, Giga [5], claims in a non-peer-reviewed blog
post to reduce voice-agent hallucination rates from 4-5% to under 1% in
production by detecting fabricated content in the gap between LLM text
generation and speech synthesis — which we read as independent,
industry-side confirmation that this is a real, live problem that the
academic literature has not yet addressed directly, strengthening the case
that our RQ2 evaluation targets a genuine, under-studied gap rather than a
hypothetical one.

**Voice agent reliability benchmarks.** τ-Voice [6] extends the τ²-bench
methodology to full-duplex voice agents across 278 tasks in retail,
airline, and telecom domains, using the same G.711 μ-law 8kHz telephony
audio format as our production system, and reports task success rates of
only 26-51% under realistic conditions — hallucination is one of several
error categories it tracks, though not its specific focus. IHBench [7] is
the closest recent work on a more targeted reliability question: whether a
voice agent correctly resumes a structured workflow after a mid-speech
interruption (barge-in), across ten enterprise domains. Both are valuable
context for the broader claim that production-grade reliability in voice
agents remains an open problem, but neither directly studies the
self-dialogue failure mode or its mitigation; we treat barge-in-style
evaluation as future work (Section 7).

**Adjacent, differently-scoped reliability work.** Two recent papers are
close enough to warrant explicitly distinguishing from this work. Dubey [8]
studies real-time detection and repair of *task-level* agent failures in
tool-using agents (LangGraph/AutoGen-style loops), using a statistical
anomaly-detection method (an echo-state-network ensemble with CUSUM
alarms) over execution traces, with rollback-and-retry as the repair
action — a different failure class (task/tool execution, not
conversational turn-taking) and a different method (statistical, not
lexical) from ours. DialFork [9] introduces a large benchmark (36,278
dialogues) for *procedural* hallucination — fluent but process-drifting
dialogue — evaluated with purpose-built flow-similarity metrics; this is
closer in spirit to our concern with conversational structure, but is an
offline benchmark-construction effort, not a live production defense
mechanism, and targets gradual process drift rather than the specific,
discrete glued-turn pattern we study. We are not aware of work combining a
live, deployed, lightweight runtime detector with an empirical study of
when the specific self-dialogue/turn-usurping pattern does and does not
occur, which is the gap this paper addresses.

**Local voice-agent latency benchmarking.** We are aware of one prior,
non-peer-reviewed benchmark using a very similar free/local stack: the
`voice-latency-lab` project [10] (public, MIT-licensed, 9 commits, 0 stars
— a small personal benchmark, not peer-reviewed) measures the same
faster-whisper and Piper versions we use (1.2.1 and 1.8.0 respectively)
plus Ollama running `qwen3.5:9b`, on an Apple M5 Pro (24GB unified memory).
Its reported figures for a Piper sentence-streaming turn (p50, averaged
over 36 turns): STT 254ms, first LLM token 70ms *after the transcript is
available*, first audio 542ms after the transcript. The first-token figure
in particular is dramatically faster than ours — we discuss the likely
hardware explanation, and what we think is the more interesting reading of
it, in Section 6. To our knowledge, no peer-reviewed study places a
free/local cascaded stack in direct, decomposed comparison against the
specific published cloud benchmarks [1], [2] we compare against here.

## 3. System Description

The system under study is a working AI phone-receptionist pipeline,
originally built for real (non-research) deployment, whose relevant logic
we reuse directly rather than reimplementing for this paper. The production
architecture is:

- **STT:** Deepgram, streaming, receiving telephony audio natively in
  mulaw 8kHz with no resampling step — chosen specifically to minimize
  latency by avoiding unnecessary audio format conversion.
- **LLM ("the brain"):** any OpenAI-compatible chat-completions endpoint;
  in production, routed through OpenRouter to a Groq-hosted reasoning
  model, chosen for Groq's inference speed.
- **TTS:** Cartesia, streaming.
- **Telephony:** Twilio.

The component central to this paper is the LLM-driving class (`Brain`),
which is architecturally decoupled from STT/TTS/telephony: it accepts and
returns plain text, and streams a chat-completion response sentence by
sentence via a callback, so that TTS synthesis of the first sentence can
begin before the rest of the reply has finished generating — the
overlapping-execution technique also described in [1] as key to perceived
responsiveness.

### 3.1 The self-dialogue hallucination failure mode

The production system's engineering team observed, in real call
transcripts, that the LLM would occasionally produce a reply containing
more than one conversational turn glued together with no space after a
sentence boundary — for example, continuing *"...reach you? Got it. What
is the reason..."* as a single generated block, effectively answering a
question it had just asked and inventing the caller's intervening response.
The deployed mitigation is a lightweight, punctuation-based heuristic: a
capital letter immediately following a sentence-ending punctuation mark,
with no intervening space, is treated as the boundary of a glued second
turn, and the stream is truncated at that point before anything past it is
spoken. This is implemented as a single regular expression
(`/[.?!]["')\]]?(?=[A-Z])/`) applied incrementally as tokens stream in, and
is active whenever a call context (`singleSegment: true`) requires the
reply to be a single conversational turn — the receptionist use case
studied in this paper.

We treat this heuristic, and the real engineering motivation behind it, as
the direct object of study for RQ2.

## 4. Methodology

All experiments run on a single consumer laptop (8-core/16-thread CPU,
32GB RAM, 4GB VRAM discrete GPU) using a predominantly free, local
software stack: Ollama for LLM inference, faster-whisper for STT, and
Piper for TTS. The one exception is one condition within RQ2 (Section
4.1), which calls the actual production model through its actual
production provider via a paid API at a real but negligible cost.

### 4.1 RQ2 — Self-dialogue hallucination

We drive the real `Brain` class directly with scripted, multi-turn caller
inputs — bypassing STT/TTS/telephony entirely, since the failure mode and
its mitigation are both purely properties of the LLM-facing text layer.
Seven scenarios were scripted to resemble a real front-desk clinic phone
call, including two designed specifically to invite rambling or
multi-topic replies likely to provoke the target failure mode (a caller
raising several loosely related concerns in one turn; a caller rapidly
switching topics). Each scenario was run against **three** models at two
temperature settings (0.4, matching the production system's configured
value; 0.8, a deliberate stress condition), in both the production
`singleSegment: true` mode (heuristic active) and a `false` counterfactual
(heuristic disabled, to inspect the raw, uncut model output as ground
truth): two general-purpose open-weight models run locally and free via
Ollama (`llama3:8b`, `qwen2.5:7b`), and — critically — the actual
production model, `openai/gpt-oss-20b`, run through the exact production
serving path (OpenRouter, pinned to the `Groq` provider via the same
`provider: { order: ['Groq'] }` mechanism `src/brain.js` already supports),
using a fresh, research-only API key at a real but negligible cost (66
calls, ~\$0.002 total). This produced 85 real conversational turns across
the heuristic-active condition, 33 of them against the production model
specifically. All raw transcripts are released alongside this paper
(`research/runs/*.json`).

**Heuristic robustness check (false positives).** The LLM-driven
evaluation above tests recall-style behavior — does the heuristic fire
when it should. It says nothing about precision — whether it also fires
when it should *not*. Because `firstSegmentEnd()` is a pure, deterministic
function of its input text, we additionally ran it directly (no LLM
involved) against a small, hand-constructed set of sentences containing
common abbreviations, to check whether ordinary front-desk language could
trigger a false positive. We found two confirmed categories where it can:
(a) an abbreviation period immediately followed by a capital letter with
no intervening space (e.g., "Dr.Smith"), and, more importantly, (b)
**multi-letter, all-capital dotted abbreviations, where the false trigger
comes from *within* the abbreviation itself regardless of what follows**
— "U.S." contains a period between "U" and "S," which the heuristic cannot
distinguish from a genuine sentence boundary, so "located in the U.S. Give
us a call." is cut after "U." even though the sentence is entirely
well-formed and properly spaced. Ordinary single-letter-prefix
abbreviations with a space after them (Dr., Mr., St., a.m., e.g., Inc.)
did **not** trigger a false positive in our tests. We report the exact
test cases and this methodology note in `research/regex_robustness.mjs`.

### 4.2 RQ1 — Latency

We measure four quantities per conversational turn: (1) STT latency,
transcribing synthetic caller audio (itself generated via Piper, since no
live microphone capture was available in this automated setting) with
faster-whisper; (2) LLM time-to-first-token, the wall-clock time from
request start to the first streamed content chunk; (3) LLM
time-to-first-complete-sentence, the time until the first full sentence is
available to hand to TTS — the quantity that actually gates when audio
playback can begin in the real pipeline; and (4) TTS latency, synthesizing
that first sentence with Piper. STT and TTS inference run against a warm,
persistent local server (`research/stt_tts_server.py`) so that one-time
model-load cost is excluded from the measured per-call latency. For each
model, one warm-up turn is run and discarded before the thirty measured
turns (increased from an initial pilot of ten, specifically so p90 is a
meaningful statistic rather than just the 9th of 10 raw values),
for the same reason on the LLM side (Ollama unloads idle models after a
timeout, so the first call after a server restart pays a model-load cost
not representative of steady-state operation).

## 5. Results

### 5.1 RQ2

| Model | Temperature | Turns | Self-dialogue cuts triggered |
|---|---|---|---|
| llama3:8b (local) | 0.4 | 8 | 0 |
| llama3:8b (local) | 0.8 | 9 | 0 |
| qwen2.5:7b (local) | 0.4 | 18 | 0 |
| qwen2.5:7b (local) | 0.8 | 17 | 0 |
| **openai/gpt-oss-20b (production model, via OpenRouter→Groq)** | 0.4 | 16 | 0 |
| **openai/gpt-oss-20b (production model, via OpenRouter→Groq)** | 0.8 | 17 | 0 |

**0 of 85 turns** triggered the heuristic, across all three models, both
temperatures, including the two scenarios designed to provoke rambling —
and including **33 turns against the actual production model run through
its actual production provider**, which directly closes what was this
paper's single biggest open limitation at an earlier draft stage.

We manually inspected all raw (heuristic-disabled and heuristic-enabled)
replies across all three models for both scenarios designed to provoke
rambling — 46 turns in total, exceeding our own planned spot-check — and
confirmed they are genuine single-turn, well-formed responses, not
instances of the target failure mode that the heuristic failed to catch.

This manual inspection surfaced a second, *different* hallucination type
that RQ2's heuristic is not designed to catch and that we do not count
toward the self-dialogue result above: factual fabrication of an
unverifiable record detail. The rambling-caller scenario's follow-up turn
asks the agent to recall which physician saw the caller's daughter on a
prior visit — information the agent has no way to actually know. Across
every applicable turn where this follow-up fired (excluding turns where
the scripted conversation ended before reaching it), **the two local
models fabricated a specific, plausible-sounding physician name as
settled fact in 3 of 4 instances** ("Dr. Patel did see your daughter in
March," "Dr. Smith saw your daughter in March" — two different invented
names across two different runs), while **the production model
(`gpt-oss-20b`) correctly declined in all 4 of its applicable
instances** ("I'm not sure which doctor saw her... I'll check our
records and let you know," "I don't have that specific information"),
consistent with the broader pattern that it is the more conservative of
the three models tested.

**Heuristic robustness check (10 deterministic test cases, Section 4.1).**
8 of 10 cases behaved as a correct heuristic should (no false cut on
ordinary language; a correct cut on a genuine glued turn). The remaining 2
are confirmed false positives: an abbreviation with no following space
("Dr.Smith"), and — more importantly, because it requires no formatting
error at all — **any multi-letter, all-capital dotted abbreviation**
("U.S.", and by the same logic "U.K.", "U.N.", "U.S.A."), where the
regex's trigger condition is satisfied *inside* the abbreviation itself.
We note that none of our 7 RQ2 scenarios happened to contain this specific
pattern, which means **our 0/85 result should not be read as evidence this
false-positive mode doesn't occur in practice — only that our scenarios
did not happen to probe for it.** This is exactly the kind of narrow,
specific, checkable finding we think matters more than a vague
"the heuristic seems fine": a clinic receptionist discussing insurance
coverage is a plausible, realistic context for "U.S." to come up, and
every occurrence would currently be a false cut.

### 5.2 RQ1

| Model | STT (p50/p90, ms) | LLM first-token (p50/p90, ms) | LLM first-sentence (p50/p90, ms) | TTS (p50/p90, ms) | Total (p50/p90, ms) |
|---|---|---|---|---|---|
| llama3:8b | 770 / 837 | 1115 / 1176 | 7392 / 11760 | 260 / 416 | 8417 / 12833 |
| qwen2.5:7b | 770 / 855 | 953 / 1108 | 6151 / 7988 | 225 / 347 | 7161 / 8983 |

(n=30 turns per model.)

Compared against the two published cloud benchmarks:

| | STT | LLM first-token / TTFT | TTS | Total |
|---|---|---|---|---|
| Salesforce AI Research [1], cloud cascade | ~337ms | — (TTFA only) | — | 755ms (TTFA) |
| Telecom voice agents [2], cloud cascade | 50ms | 670ms (avg) | 280ms | ~1000ms |
| This work — llama3:8b, local/free | 770ms | **1115ms** | 260ms | 8417ms |
| This work — qwen2.5:7b, local/free | 770ms | **953ms** | 225ms | 7161ms |

**A note on the "Total" column:** this is not a single apples-to-apples
quantity across rows. The literature's "Total"/TTFA is time to first audio,
gated by the LLM's *first token*. Our "Total" is gated by the LLM's first
*complete sentence*, because that is the quantity that actually determines
when our TTS leg can start in this pipeline's design (Section 3). The
**LLM first-token / TTFT column is the one directly comparable** across all
four rows; we report Total for completeness, not as a single clean
benchmark number.

## 6. Discussion

**Latency.** The headline finding is not that our free/local stack is
slower overall — it is, by roughly an order of magnitude — but *where* the
gap actually is. STT is 2.3x slower than the Salesforce figure (337ms) and
15.4x slower than the telecom paper's figure (50ms), consistent with
running batch CPU inference (faster-whisper) rather than a GPU-accelerated
streaming service (Deepgram). TTS (Piper) is, perhaps surprisingly,
competitive with the cloud figures (225-260ms vs. 100-280ms), suggesting a
well-chosen free local TTS engine is not a meaningful bottleneck for this
use case. The more interesting result is on the LLM leg:
time-to-first-token (953-1115ms at the median, n=30) is only 1.4-1.7x
slower than the telecom paper's reported LLM average of 670ms, despite
running on a consumer laptop with only 4GB of VRAM — a much smaller
relative gap than we expected going in. The real cost is sustained
generation speed: time-to-first-complete-sentence balloons to 6.2-7.4
seconds at the median (and up to 11.8s at p90), meaning that once
generation starts, our local setup produces tokens far more slowly than
cloud providers do. This is a plausible, concrete explanation for why
production voice-agent systems — including the one this paper's code is
drawn from — route LLM inference through providers like Groq even when
using open-weight models: the advantage is not in getting started, it is in
how fast tokens keep arriving once started, which is precisely what
specialized inference hardware is built for.

This is corroborated, and usefully complicated, by comparison against the
`voice-latency-lab` benchmark [10] (Section 2), which measures an
almost-identical free/local stack — the same faster-whisper (1.2.1) and
Piper (1.8.0) versions we use — but reports a local LLM first-token
latency of only ~70ms after the transcript is available, using a *larger*
model (`qwen3.5:9b`, 9B parameters) than either of ours. That is
**13.6-15.9x faster than our median first-token figures (953-1115ms)**,
despite their model being larger, not smaller. The most likely explanation
is not the model but the hardware: that benchmark runs on an Apple M5 Pro
with 24GB of unified memory, so the entire model and its KV cache stay in
fast, GPU-accessible memory throughout generation; ours runs on a Windows
laptop with a 4GB discrete GPU too small to hold either tested model
fully in VRAM, forcing partial CPU offload for a large share of the
computation. Taken together, the two results suggest something stronger
than "free/local is somewhat slower than cloud": **the dominant factor in
free/local LLM latency may be memory architecture (unified vs. discrete,
and whether the model fits) rather than raw compute power or model size.**
We did not anticipate this before running the comparison, and we think it
is independently worth reporting (Section 7) — a reader deciding whether a
free/local voice-agent stack is viable for their use case should weigh
their target hardware's memory architecture well before its raw
GPU/TFLOPS specification.

**Reliability.** We report RQ2 plainly as a negative result: the specific
failure mode the production heuristic was built to catch did not occur, at
all, across 85 real turns spanning three models (including the actual
production model, run through its actual production provider), two
temperatures, and scenarios designed to provoke it. This is a materially
stronger negative result than an earlier draft of this work could report,
which only tested two unrelated models and had to leave "maybe it's the
production model specifically" open as the leading explanation. Testing
the real model directly rules that specific explanation out, and leaves a
different, more statistically grounded one in its place: **if the true
rate at which this failure mode occurs in practice is low — say, in the
low single-digit percent, consistent with it being observed often enough
in real transcripts to justify building a defense, but not so often that
every call exhibits it — then 85 trials is not actually enough to expect
to reliably observe even one occurrence.** (At a true rate of 1%, the chance of seeing zero events in 85 independent
trials is 0.99^85 ≈ 42.6%; at 2%, 0.98^85 ≈ 18.0%; even at 5%, it is still
0.95^85 ≈ 1.3% — not negligible for a single run like ours.) We think this is the honest
reading: not "the heuristic is unnecessary," but "a problem can be real,
worth defending against, and still be rare enough that a few dozen
scripted trials won't reliably reproduce it" — which has a direct,
practical implication for anyone evaluating a similar production
heuristic: a negative result over on the order of 100 trials should not,
by itself, be read as evidence a rare failure mode doesn't exist. Read as
a *trustworthy AI* contribution specifically: a production system's own
defense mechanism is itself a legitimate object of study, and negative
replication results — reported with the statistical honesty to say what
they do and do not rule out — are exactly the kind of evidence that
should accumulate in this area, rather than only positive "our mitigation
works" claims.

## 7. Threats to Validity

We follow the standard construct/internal/external validity framing used
in empirical software engineering research, since that is the lens this
paper's claims should be read through.

**Construct validity** (are we measuring what we claim to measure?)
- Our "LLM time-to-first-sentence" is a deliberate design choice — it is
  the quantity that actually gates TTS start in this pipeline — but it is
  *not* the same construct as the literature's time-to-first-audio/TTFT,
  and we do not present it as directly comparable without the caveat given
  in Section 5.2. Only the first-token metric is presented as a direct,
  like-for-like comparison.
- "Self-dialogue hallucination" is operationalized narrowly, as what the
  `GLUED_SEGMENT` heuristic is designed to catch (a glued second
  conversational turn). The factual fabrications observed in the
  rambling-caller scenario (Section 5.1) are genuine hallucinations by
  any general definition but are outside this construct, and we do not
  count them toward RQ2's result either way.

**Internal validity** (could something other than what we claim explain
the result?)
- **Statistical power to detect a rare event.** An earlier draft of this
  work could not test the production model directly (a local download was
  impractical) and had to leave that as the leading explanation for the
  null result. We have since tested the actual production model through
  its actual production provider directly (Section 4.1), which rules that
  specific explanation out. The internal-validity question that remains is
  the one discussed in Section 6: 85 trials, even against the right model
  and provider, is not a large enough sample to confidently rule out a
  failure mode with a true occurrence rate in the low single digits —
  which is entirely consistent with a problem being real and worth
  defending against in production, while still not showing up reliably in
  a run of this size. We do not have a way to fully resolve this within
  the current draft; it is the clearest concrete next step (Section 8).
- The manual verification that RQ2's negative result is a true negative
  (Section 5.1) was performed by one of the authors, not an independent or
  blinded rater. For a result this central to the paper's framing, this is
  a real limitation we are not able to fully resolve within this draft;
  the raw transcripts are published specifically so readers can verify this
  claim themselves.

**External validity** (how far do these results generalize?)
- **Sample size.** 85 turns for RQ2 (across three models) and n=30 turns
  per model for RQ1 are enough to support the specific, narrow claims made
  here but are small relative to the kind of large-scale benchmark a
  dedicated reliability
  study (e.g., [6], [7]) would use, and do not claim to generalize beyond
  the three models tested for RQ2 (two of which were also tested for RQ1).
- **Synthetic, scripted conversations.** All caller inputs are
  hand-authored scenarios, not real call transcripts, and all RQ1 "caller
  audio" is itself synthetic (TTS-generated), not real human speech. Real
  calls introduce acoustic variation (background noise, accents, telephony
  codec artifacts) this study does not capture.
- **CPU-bound STT is not representative of a production streaming STT
  service.** Our STT numbers characterize a free/local substitute, not an
  attempt to match Deepgram's architecture.
- **Single machine, single hardware configuration.** Latency figures are
  specific to the test machine described in Section 4; we do not report
  variance across hardware. This is not a minor caveat: an independent
  benchmark of an almost-identical software stack on different hardware
  [10] reports time-to-first-token 13.6-15.9x faster than ours (Section 6)
  despite using a *larger* model, which we attribute to unified memory
  fitting the whole model and KV cache in fast GPU-accessible memory vs.
  our 4GB discrete GPU forcing partial CPU offload. Our absolute numbers
  should be read as characterizing *this specific hardware class*, not
  "the free/local stack" in general — and the gap being this large,
  driven by memory architecture rather than compute or model size, is
  itself one of this paper's more surprising findings.

## 8. Future Work

- **Run hundreds, not dozens, of trials against the production model
  specifically**, to tighten the confidence bound on the failure mode's
  true occurrence rate (Section 6) — at the per-call cost observed here
  (~\$0.00003/call), even 2,000 trials would cost under \$1, making this
  entirely feasible as a direct, low-cost follow-up rather than a
  resource-constrained one.
- A barge-in / turn-taking evaluation in the style of IHBench [7],
  adapted to this system.
- The deferred cloud-API comparison sample (a small batch run through real
  Deepgram/Groq/Cartesia accounts) to add a direct same-system cloud vs.
  local comparison column, beyond comparing against other papers' published
  figures.
- Evaluation against real (not scripted) call transcripts, subject to the
  usual privacy and consent constraints of real customer data.
- **A concrete, actionable fix for the false-positive risk found in
  Section 5.1**: special-case common all-capital dotted abbreviations
  (a short static list — "U.S.", "U.K.", "U.N.", "U.S.A." and similar —
  is enough to cover the realistic cases) before applying the
  `GLUED_SEGMENT` check, or require a minimum segment length before
  cutting. Either is a small, low-risk change to the production heuristic
  that we did not implement here (this paper evaluates the heuristic as
  deployed, not a modified version of it), but which we think should
  follow directly from this paper's own findings.

## 9. Conclusion

We present a real-world case study of a production-adjacent cascaded voice
agent, studied along both its latency profile and a specific LLM
reliability concern, using a predominantly free and independently
reproducible software stack, with one small, transparently-reported
real-money exception where it mattered most: testing the actual
production model through its actual production provider. Our latency
results locate the actual cost of running such a pipeline locally in
sustained LLM token throughput rather than in getting started, and are
directly comparable to two recent published cloud benchmarks. Our
reliability results are a clean negative finding across three models,
including the production model itself, reported honestly as a boundary
condition with an explicit statistical accounting of what a null result
over 85 trials does and does not rule out for a potentially rare failure
mode — rather than dressed up as either a positive validation or a
disproof. A deterministic robustness check of the same defense mechanism
additionally surfaced a concrete, previously undocumented false-positive
risk, with a correspondingly concrete fix. We argue that this kind of
result — when did you solve a real problem, when does it not reproduce,
and what does it break in the process of solving the first problem —
belongs in the literature on trustworthy AI voice systems alongside
positive benchmark claims.

## References

[1] Salesforce AI Research, "Building Enterprise Realtime Voice Agents from
Scratch: A Technical Tutorial," arXiv:2603.05413, 2026.

[2] "Toward Low-Latency End-to-End Voice Agents for Telecommunications,"
arXiv:2508.04721, 2025.

[3] W. Luo et al., "HalluDial: A Large-Scale Benchmark for Automatic
Dialogue-Level Hallucination Evaluation," arXiv:2406.07070, 2024.

[4] "DiaHalu: A Dialogue-level Hallucination Evaluation Benchmark for
Large Language Models," arXiv:2403.00896, 2024.

[5] Giga AI, "Real-Time Hallucination Correction at Zero Latency Cost,"
company blog post, giga.ai/hallucinations, 2026. (Non-peer-reviewed;
cited as industry context, not as a scientific claim.)

[6] "τ-Voice: Benchmarking Full-Duplex Voice Agents on Real-World
Domains," arXiv:2603.13686, 2026.

[7] Boson AI, "IHBench," arXiv:2606.19595, 2026.

[8] S. Dubey, "Real-Time Detection and Repair of LLM Agent Failures,"
arXiv:2608.02464, 2026.

[9] S. Burdisso, E. Villatoro-Tello, D. Sánchez-Cortés, Y. Labrak, J.
Luque, M. Cernak, and P. Motlicek, "DialFork: Going Beyond Factuality to
Evaluate Procedural Hallucination in Conversational Agents,"
arXiv:2610.21561, 2026.

[10] O. Özdemir (oguzhanozfe), "voice-latency-lab: Where the time goes in
a local voice-agent turn (STT → LLM → TTS), and which streaming tricks
help," github.com/oguzhanozfe/voice-latency-lab, accessed 2026-11-22.
(Public, MIT-licensed personal repository, 9 commits, 0 stars; not
peer-reviewed. Cited as the closest comparable benchmark found, with
hardware and model conditions specified in Sections 2 and 6 precisely
because the source is informal.)

---

## Reproducibility statement

Every number in this paper is generated from code and raw data published
at github.com/m-aoun/voice-agent-research. `research/analyze_results.mjs`
regenerates every table in Section 5 directly from the raw JSON logs in
`research/runs/`; nothing in this paper was hand-transcribed from a
separate analysis. `research/regex_robustness.mjs` reproduces the
deterministic false-positive check (Sections 4.1 and 5.1) independently of
any LLM or random seed — running it will print the same 10/10 result every
time.
