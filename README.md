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
TTS), tested here with a fully free/local stack: [Ollama](https://ollama.com)
for the LLM, [faster-whisper](https://github.com/SYSTRAN/faster-whisper) for
STT, and [Piper](https://github.com/rhasspy/piper) for TTS — no paid API
required to reproduce the core experiments.

## Reproducing the experiments

```bash
npm install  # none needed — zero dependencies, plain Node.js 22+

# RQ2 — self-dialogue hallucination (needs Ollama running locally)
HARNESS_MODELS=llama3:8b,qwen2.5:7b HARNESS_TEMPERATURES=0.4,0.8 \
  node research/hallucination_harness.mjs

# RQ1 — latency (needs the warm STT/TTS server running first)
pip install faster-whisper piper-tts
python research/stt_tts_server.py &
HARNESS_MODELS=llama3:8b,qwen2.5:7b node research/rq1_latency_harness.mjs
```

Results land in `research/runs/*.json`.

## Status

This is a work in progress. See `status.html` (open it in a browser) for a
live-updated breakdown of what's done, what's in progress, and what's left.

## License

MIT — see [LICENSE](LICENSE).

## Author

Muhammad Aoun Shabbir — [github.com/m-aoun](https://github.com/m-aoun)
