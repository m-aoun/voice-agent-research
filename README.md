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

## Status

This is a work in progress. See `status.html` (open it in a browser) for a
live-updated breakdown of what's done, what's in progress, and what's left.

## License

MIT — see [LICENSE](LICENSE).

## Author

Muhammad Aoun Shabbir — [github.com/m-aoun](https://github.com/m-aoun)
