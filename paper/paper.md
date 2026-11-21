# Real-Time Self-Dialogue Hallucination Detection in Cascaded LLM Voice Agents: A Latency and Reliability Case Study

**Authors:** Muhammad Aoun Shabbir¹, [Muhammad Sadiq²] *(co-authorship pending confirmation — draft circulated for review before any author list is finalized)*

¹ Independent researcher
² Shenzhen University of Information Technology (SUIT), Shenzhen, China

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
system's production code, instrumented to run entirely on a free, local
stack (Ollama, faster-whisper, Piper) so every result here is independently
reproducible at zero cost. For latency (RQ1), we find our local
time-to-first-token is only 1.5-2.4x slower than published cloud figures
despite running on a 4GB consumer laptop GPU, but sustained token throughput
(time-to-first-complete-sentence) is the dominant cost, 7.5-10.7 seconds —
the real gap between a free/local stack and specialized inference providers
like Groq is throughput, not startup latency. For reliability (RQ2), we
evaluate a lightweight, already-deployed runtime heuristic
(`GLUED_SEGMENT`) that detects and truncates self-dialogue mid-stream before
it reaches the caller. Across 52 scripted conversational turns, 2
general-purpose open-weight models, and 2 temperature settings, we find
**zero** instances of the failure mode the heuristic was built to catch —
a negative result that, combined with manual verification that these are
true negatives rather than missed detections, suggests the failure mode may
be specific to the production system's original model (a reasoning model
served via a different provider) rather than a universal property of LLMs
in this role. We report this honestly as a boundary condition on the
heuristic's necessity, not a positive validation of its accuracy, and
discuss what that implies for treating LLM voice agents as *trustworthy AI
systems* in practice.

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

We run every experiment on a fully free, local software stack — Ollama for
the LLM, faster-whisper for STT, Piper for TTS — so that every number in
this paper is independently reproducible by any reader at zero monetary
cost, using the code published alongside this paper.

Our contributions:
1. A real-world latency characterization of a free/local cascaded voice
   pipeline, broken into STT, LLM time-to-first-token, LLM
   time-to-first-complete-sentence, and TTS, compared against two recent
   published cloud benchmarks [1], [2].
2. An evaluation of a production self-dialogue-hallucination defense across
   two open-weight LLMs, two temperature settings, and seven realistic
   front-desk conversational scenarios — reported as a negative/boundary
   result, with manual verification that it is a true negative rather than
   a missed detection, and a discussion of what that implies about the
   failure mode's generality.
3. A fully open, zero-cost, reproducible experimental artifact — code,
   scripts, and raw result data — released alongside this paper.

## 2. Related Work

**Cascaded voice agent latency.** Salesforce AI Research [1] presents a
technical tutorial for building self-hosted, enterprise-grade real-time
voice agents, arguing that native speech-to-speech models remain too slow
for real-time use (their measurement: ~13s time-to-first-audio for
Qwen2.5-Omni) and that the cascaded STT → LLM → TTS pipeline, with
overlapping execution between stages, is the practical architecture for
production. They report a time-to-first-audio (TTFA) of 755ms (best-case
729ms) using Deepgram streaming STT, a self-hosted or API-served LLM, and
ElevenLabs streaming TTS, with a reported STT component latency of ~337ms.
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
32GB RAM, 4GB VRAM discrete GPU) using a fully free, local software stack:
Ollama for LLM inference, faster-whisper for STT, and Piper for TTS. No
paid API calls were made for any result reported here.

### 4.1 RQ2 — Self-dialogue hallucination

We drive the real `Brain` class directly with scripted, multi-turn caller
inputs — bypassing STT/TTS/telephony entirely, since the failure mode and
its mitigation are both purely properties of the LLM-facing text layer.
Seven scenarios were scripted to resemble a real front-desk clinic phone
call, including two designed specifically to invite rambling or
multi-topic replies likely to provoke the target failure mode (a caller
raising several loosely related concerns in one turn; a caller rapidly
switching topics). Each scenario was run against two general-purpose
open-weight models available via Ollama (`llama3:8b`, `qwen2.5:7b`), at two
temperature settings (0.4, matching the production system's configured
value; 0.8, a deliberate stress condition), in both the production
`singleSegment: true` mode (heuristic active) and a `false` counterfactual
(heuristic disabled, to inspect the raw, uncut model output as ground
truth). This produced 52 real conversational turns across the heuristic-
active condition. All raw transcripts are released alongside this paper
(`research/runs/*.json`).

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
model, one warm-up turn is run and discarded before the ten measured turns,
for the same reason on the LLM side (Ollama unloads idle models after a
timeout, so the first call after a server restart pays a model-load cost
not representative of steady-state operation).

## 5. Results

### 5.1 RQ2

| Model | Temperature | Turns | Self-dialogue cuts triggered |
|---|---|---|---|
| llama3:8b | 0.4 | 8 | 0 |
| llama3:8b | 0.8 | 9 | 0 |
| qwen2.5:7b | 0.4 | 18 | 0 |
| qwen2.5:7b | 0.8 | 17 | 0 |

**0 of 52 turns** triggered the heuristic, across both models, both
temperatures, including the two scenarios designed to provoke rambling. We
manually inspected the corresponding raw (heuristic-disabled) replies for
these scenarios and confirmed they are genuine single-turn, well-formed
responses — not instances of the target failure mode that the heuristic
failed to catch. One reply did fabricate a plausible-but-unverified detail
(inventing which physician had seen a patient previously), which is a
*different* hallucination type (factual fabrication) than the self-dialogue
pattern this heuristic targets, and is out of scope for this paper.

### 5.2 RQ1

| Model | STT (p50/p90, ms) | LLM first-token (p50/p90, ms) | LLM first-sentence (p50/p90, ms) | TTS (p50/p90, ms) | Total (p50/p90, ms) |
|---|---|---|---|---|---|
| llama3:8b | 939 / 1197 | 1199 / 1583 | 10732 / 13188 | 197 / 390 | 11657 / 14553 |
| qwen2.5:7b | 1024 / 1204 | 1138 / 1495 | 7572 / 9825 | 254 / 370 | 8830 / 11280 |

Compared against the two published cloud benchmarks:

| | STT | LLM first-token / TTFT | TTS | Total |
|---|---|---|---|---|
| Salesforce AI Research [1], cloud cascade | ~337ms | — (TTFA only) | — | 755ms (TTFA) |
| Telecom voice agents [2], cloud cascade | 50ms | 670ms (avg) | 280ms | ~1000ms |
| This work — llama3:8b, local/free | 939ms | **1199ms** | 274ms | 11657ms |
| This work — qwen2.5:7b, local/free | 1024ms | **1138ms** | 254ms | 8830ms |

## 6. Discussion

**Latency.** The headline finding is not that our free/local stack is
slower overall — it is, by roughly an order of magnitude — but *where* the
gap actually is. STT is 3-20x slower than the cloud figures, consistent
with running batch CPU inference (faster-whisper) rather than a
GPU-accelerated streaming service (Deepgram). TTS (Piper) is, perhaps
surprisingly, competitive with the cloud figures (197-390ms vs. 100-280ms),
suggesting a well-chosen free local TTS engine is not a meaningful
bottleneck for this use case. The more interesting result is on the LLM
leg: time-to-first-token (1.1-1.6s) is only 1.5-2.4x slower than the
telecom paper's reported LLM average of 670ms, despite running on a
consumer laptop with only 4GB of VRAM — a much smaller relative gap than we
expected going in. The real cost is sustained generation speed:
time-to-first-complete-sentence balloons to 7.5-10.7 seconds, meaning that
once generation starts, our local setup produces tokens far more slowly
than cloud providers do. This is a plausible, concrete explanation for why
production voice-agent systems — including the one this paper's code is
drawn from — route LLM inference through providers like Groq even when
using open-weight models: the advantage is not in getting started, it is in
how fast tokens keep arriving once started, which is precisely what
specialized inference hardware is built for.

**Reliability.** We report RQ2 plainly as a negative result: the specific
failure mode the production heuristic was built to catch did not occur, at
all, across 52 real turns spanning two models, two temperatures, and
scenarios designed to provoke it. We do not read this as evidence the
heuristic is unnecessary in general — it was built in direct response to
observed behavior in the production system's original model, served via a
different provider, which this experiment did not have the opportunity to
test directly (Section 7). We instead read it as a genuine boundary
condition: self-dialogue hallucination, at least as triggered under the
conditions we tested, may be specific to a particular model or serving
path rather than a universal property of LLMs used in this role. This
reframes the contribution from "here is how well this heuristic performs"
to "here is a lightweight runtime technique that exists because it solved
a real production problem, and here is evidence about which conditions do
and do not reproduce that problem" — which we think is the more honest and,
ultimately, more useful claim for anyone building a similar system to be
able to rely on. Read as a *trustworthy AI* contribution specifically: a
production system's own defense mechanism is itself a legitimate object of
study, and negative replication results about when a failure mode does or
does not occur are exactly the kind of evidence that should accumulate in
this area, rather than only positive "our mitigation works" claims.

## 7. Limitations

- **The production model was not tested directly.** The original system's
  LLM is a specific reasoning model served via a specific provider; we
  tested two different, general-purpose open-weight models instead,
  because the production model was not locally available within the time
  and bandwidth constraints of this work (a 13GB download at the available
  connection speed was not practical during this study — see repository
  history for details). This is the single most important open question
  this paper leaves for future work.
- **Sample size.** 52 turns for RQ2 and 10 turns per model for RQ1 are
  sufficient to support the specific claims made here but are small
  relative to the kind of large-scale benchmark a dedicated reliability
  study (e.g., [6], [7]) would use.
- **Synthetic, scripted conversations.** All caller inputs are
  hand-authored scenarios, not real call transcripts, and all RQ1 "caller
  audio" is itself synthetic (TTS-generated), not real human speech. Real
  calls introduce acoustic variation (background noise, accents, telephony
  codec artifacts) this study does not capture.
- **CPU-bound STT is not representative of a production streaming STT
  service.** Our STT numbers characterize a free/local substitute, not an
  attempt to match Deepgram's architecture.
- **Single machine, single run per condition.** We do not report
  variance across hardware or across repeated runs of the same condition.

## 8. Future Work

- Test the actual production model directly once bandwidth allows a
  13GB local download, to determine whether the self-dialogue failure mode
  reproduces there specifically.
- A barge-in / turn-taking evaluation in the style of IHBench [7],
  adapted to this system.
- The deferred cloud-API comparison sample (a small batch run through real
  Deepgram/Groq/Cartesia accounts) to add a direct same-system cloud vs.
  local comparison column, beyond comparing against other papers' published
  figures.
- Evaluation against real (not scripted) call transcripts, subject to the
  usual privacy and consent constraints of real customer data.

## 9. Conclusion

We present a real-world case study of a production-adjacent cascaded voice
agent, studied along both its latency profile and a specific LLM
reliability concern, using a fully free and independently reproducible
local software stack. Our latency results locate the actual cost of
running such a pipeline locally in sustained LLM token throughput rather
than in getting started, and are directly comparable to two recent
published cloud benchmarks. Our reliability results are a clean negative
finding, reported honestly as a boundary condition rather than dressed up
as a positive validation, and we argue that this kind of result — when did
you solve a real problem, and when does it not reproduce — belongs in the
literature on trustworthy AI voice systems alongside positive benchmark
claims.

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

---

## Reproducibility statement

Every number in this paper is generated from code and raw data published
at github.com/m-aoun/voice-agent-research. `research/analyze_results.mjs`
regenerates every table in Section 5 directly from the raw JSON logs in
`research/runs/`; nothing in this paper was hand-transcribed from a
separate analysis.
