# Voice Agent Research — Self-Dialogue Hallucination & Latency

Research code and experiment data for a paper on real-time LLM voice agents:

- **RQ1:** How does a low-cost, self-built cascaded voice pipeline
  (speech-to-text → LLM → text-to-speech) perform against published
  enterprise latency benchmarks?
- **RQ2:** How often does the LLM hallucinate *both sides* of a live call
  (answers itself, invents what the caller said), and how well does a
  lightweight runtime heuristic detect/stop it compared to no detection at
  all?

Built around a real, working AI phone-receptionist pipeline (STT → LLM →
TTS), tested here with a predominantly free/local stack:
[Ollama](https://ollama.com) for the LLM, [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
for STT, and [Piper](https://github.com/rhasspy/piper) for TTS. The one
exception: RQ2 also tests the actual production model
(`openai/gpt-oss-20b`) through its actual production provider
([OpenRouter](https://openrouter.ai), pinned to Groq), which requires a
paid API key — real cost incurred for that condition was a few cents.
Every other result in this repo costs $0 to reproduce.

The full paper draft is in [`paper/paper.md`](paper/paper.md); the raw
experiment data behind every number it cites is in
[`research/RESULTS.md`](research/RESULTS.md) and `research/runs/*.json`.

## Reproducing the experiments

```bash
npm install  # none needed — zero dependencies, plain Node.js 22+

# RQ2 — self-dialogue hallucination (needs Ollama running locally)
HARNESS_MODELS=llama3:8b,qwen2.5:7b HARNESS_TEMPERATURES=0.4,0.8 \
  node research/hallucination_harness.mjs

# RQ2, production-model condition (paid — needs an OpenRouter API key with
# a small spending limit; real cost is a few cents for the full run)
LLM_BASE_URL=https://openrouter.ai/api/v1/chat/completions \
LLM_API_KEY=sk-or-v1-... LLM_PROVIDER=Groq \
HARNESS_MODELS=openai/gpt-oss-20b HARNESS_TEMPERATURES=0.4,0.8 \
  node research/hallucination_harness.mjs

# RQ1 — latency (needs the warm STT/TTS server running first)
pip install faster-whisper piper-tts
python research/stt_tts_server.py &
HARNESS_MODELS=llama3:8b,qwen2.5:7b node research/rq1_latency_harness.mjs
```

Results land in `research/runs/*.json`. Regenerate the summary tables with
`node research/analyze_results.mjs` (writes `research/RESULTS.md`).

## Status

This is a work in progress. See `status.html` (open it in a browser) for a
live-updated breakdown of what's done, what's in progress, and what's left.

## License

MIT — see [LICENSE](LICENSE).

## Author

Muhammad Aoun Shabbir — [github.com/m-aoun](https://github.com/m-aoun)
