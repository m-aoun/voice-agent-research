"""
Tiny local HTTP server exposing STT (faster-whisper) and TTS (Piper) over
HTTP, loaded once and kept warm — so the RQ1 latency harness measures real
per-call inference latency, not one-time model-load time.

Run:
  python research/stt_tts_server.py

Endpoints:
  POST /stt   body: raw WAV bytes            -> {"text": "...", "ms": 123}
  POST /tts   body: {"text": "..."}          -> WAV bytes (header: X-Latency-Ms)

Known issue worked around here: the installed PyAV (19.0.2) removed the
`metadata_errors` kwarg that this faster-whisper version's decode_audio()
passes to av.open(), so any file-path-based transcribe() call throws
TypeError. Downgrading PyAV isn't viable either — no prebuilt wheel exists
for this Python version (3.14) below 19.x, and building from source failed
(no local FFmpeg dev headers). Fix: decode the WAV ourselves with the
stdlib `wave` module and hand faster-whisper a numpy array directly,
bypassing PyAV entirely. Logged in PROJECT.md's error log.
"""

import io
import json
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from faster_whisper import WhisperModel
from piper import PiperVoice

PORT = 8765
VOICE_PATH = "models/piper/en_US-amy-medium.onnx"

print("Loading faster-whisper (base.en, cpu, int8)...")
stt_model = WhisperModel("base.en", device="cpu", compute_type="int8")
print("Loading Piper voice...")
tts_voice = PiperVoice.load(VOICE_PATH)
print("Both models loaded. Serving on port", PORT)


def wav_bytes_to_float32(raw_bytes):
    with wave.open(io.BytesIO(raw_bytes), "rb") as wf:
        sr = wf.getframerate()
        n = wf.getnframes()
        raw = wf.readframes(n)
        audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return audio, sr


def synthesize_to_wav_bytes(text):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(tts_voice.config.sample_rate)
        for chunk in tts_voice.synthesize(text):
            wf.writeframes(chunk.audio_int16_bytes)
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep stdout clean; latency is what we care about

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        if self.path == "/stt":
            t0 = time.time()
            audio, sr = wav_bytes_to_float32(body)
            segments, _info = stt_model.transcribe(audio)
            text = " ".join(s.text for s in segments).strip()
            ms = (time.time() - t0) * 1000
            payload = json.dumps({"text": text, "ms": ms}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        elif self.path == "/tts":
            data = json.loads(body)
            t0 = time.time()
            wav = synthesize_to_wav_bytes(data["text"])
            ms = (time.time() - t0) * 1000
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("X-Latency-Ms", str(ms))
            self.send_header("Content-Length", str(len(wav)))
            self.end_headers()
            self.wfile.write(wav)

        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.serve_forever()
