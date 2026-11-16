// Adapted, unmodified-in-logic, from the real production AI phone
// receptionist pipeline (a private system, not published) — this is the
// exact LLM-driving class this paper studies, with one change: the config
// import is replaced by plain env vars so this repo has zero dependency on
// the private business codebase. No business names, client data or secrets
// were ever in this file; it's pure pipeline engineering logic.
//
// Defaults point at a local Ollama instance (free, no API key needed).
// Override via env vars to point at a cloud OpenAI-compatible endpoint
// instead (see README).

const llmConfig = {
  baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434/v1/chat/completions',
  apiKey: process.env.LLM_API_KEY || 'ollama',
  model: process.env.LLM_MODEL || 'llama3:8b',
  // OpenRouter-specific provider pin; ignored by Ollama and by any other
  // OpenAI-compatible host if left blank.
  provider: process.env.LLM_PROVIDER || '',
};

/** OpenAI-compatible chat completions body every call shares. */
function llmBody(overrides) {
  const body = {
    model: llmConfig.model,
    reasoning_effort: 'low',
    ...overrides,
  };
  // reasoning_effort only means something to reasoning models (gpt-oss); some
  // hosts reject it for ordinary ones.
  if (!/gpt-oss|o\d|reason/i.test(body.model)) delete body.reasoning_effort;
  if (llmConfig.provider) {
    body.provider = { order: [llmConfig.provider], allow_fallbacks: true };
  }
  return body;
}

/**
 * Markers the model can emit to control the call. They are stripped out
 * before anything reaches the caller's ear — the prospect never hears them.
 */
const MARKERS = {
  TRANSFER: /\[TRANSFER\]/i,
  END: /\[END:([a-z_]+)\]/i,
  // Free text, not a fixed enum — the model raises its hand with whatever the
  // actual question or objection was, so a human can teach it the answer
  // later instead of it guessing live.
  FLAG: /\[FLAG:([^\]]+)\]/i,
  FOLLOWUP: /\[FOLLOWUP:([^\]]+)\]/i,
};

/**
 * Some replies come back as several separate "turns" glued together with no
 * space after the full stop ("...reach you?Got it. What is the reason...?"),
 * which is the model carrying on the whole conversation by itself — including
 * inventing the caller's answers. Real prose always has a space after the
 * sentence end, so a capital letter right after one marks where the first,
 * real reply stops. Returns the index to cut at, or -1 if the text is clean.
 *
 * This is RQ2's subject: a lightweight, deployed-in-production heuristic for
 * detecting self-dialogue hallucination in a live LLM voice agent.
 */
const GLUED_SEGMENT = /[.?!]["')\]]?(?=[A-Z])/;
export function firstSegmentEnd(text) {
  const m = GLUED_SEGMENT.exec(text);
  return m ? m.index + m[0].length : -1;
}

/** Where a sentence can safely be handed to the voice, mid-stream. */
const SENTENCE_END = /[.!?]["')\]]?\s$|[.!?]["')\]]?$/;

export class Brain {
  /**
   * @param {string} systemPrompt
   * @param {{ warn: (msg: any, ...rest: any[]) => void }} log
   */
  constructor(systemPrompt, log, { singleSegment = false, summaryPrompt, model } = {}) {
    this.log = log;
    this.summaryPrompt = summaryPrompt;
    this.model = model; // per-call override of llmConfig.model
    this.singleSegment = singleSegment; // drop anything glued after the first reply
    this.messages = [{ role: 'system', content: systemPrompt }];
    this.outcome = null;     // set when the model emits [END:reason]
    this.wantsTransfer = false;
    this.flags = [];         // questions the model raised via [FLAG:...]
    this.followUps = [];     // commitments made via [FOLLOWUP:...]
  }

  addUser(text) {
    this.messages.push({ role: 'user', content: text });
  }

  addAssistant(text) {
    if (text?.trim()) this.messages.push({ role: 'assistant', content: text.trim() });
  }

  nudge(text) {
    this.messages.push({ role: 'system', content: text });
  }

  restore(pastMessages = []) {
    this.messages.push(...pastMessages.filter((m) => m.role !== 'system'));
  }

  /**
   * Stream one reply. Sentences are handed to `onSentence` the moment they
   * are complete, mirroring the real voice pipeline where the TTS leg starts
   * speaking before the full reply is written.
   *
   * @param {object} opts
   * @param {(sentence: string) => void} opts.onSentence
   * @param {AbortSignal} [opts.signal]
   * @returns {Promise<{ text: string, transfer: boolean, end: string|null, flag: string|null, followUp: string|null }>}
   */
  async respond(opts) {
    let result;
    let lastErr = null;
    let useDefaultModel = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      lastErr = null;
      try {
        result = await this.#respondOnce(opts, useDefaultModel);
      } catch (err) {
        if (opts.signal?.aborted || err?.name === 'AbortError') throw err;
        lastErr = err;
        this.log.warn?.({ err: err.message, attempt: attempt + 1 }, 'LLM request failed — retrying');
        if (this.model) useDefaultModel = true;
        continue;
      }
      if (result.text.trim() || result.end || result.transfer || opts.signal?.aborted) break;
      this.log.warn?.({ attempt: attempt + 1 }, 'LLM returned an empty reply — retrying');
      if (this.model) useDefaultModel = true;
    }
    if (lastErr && !result?.text?.trim()) throw lastErr;
    return result;
  }

  async #respondOnce({ onSentence, signal }, useDefaultModel = false) {
    const res = await fetch(llmConfig.baseUrl, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(llmBody({
        ...(this.model && !useDefaultModel ? { model: this.model } : {}),
        messages: this.messages,
        stream: true,
        temperature: 0.4,
        max_tokens: 160,
        frequency_penalty: 0.4,
      })),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';   // raw SSE buffer
    let spoken = '';   // text not yet handed to the voice
    let full = '';     // everything the model produced
    let truncated = false;

    const flushSentence = (force = false) => {
      const candidate = spoken;
      if (!candidate.trim()) return;
      if (force || SENTENCE_END.test(candidate)) {
        const clean = stripMarkers(candidate).trim();
        spoken = '';
        if (clean) onSentence(clean);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (!delta) continue;

        if (this.singleSegment) {
          // Look a few characters back so a boundary split across two chunks is still seen.
          const from = Math.max(0, full.length - 3);
          const cut = firstSegmentEnd((full + delta).slice(from));
          if (cut !== -1) {
            const keep = (full + delta).slice(0, from + cut);
            spoken += keep.slice(full.length);
            full = keep;
            flushSentence(true);
            await reader.cancel().catch(() => {});
            this.log.warn?.('dropped extra text glued after the first reply');
            truncated = true;
            break;
          }
        }

        full += delta;
        spoken += delta;
        flushSentence();
      }
      if (truncated) break;
    }

    flushSentence(true);

    const transfer = MARKERS.TRANSFER.test(full);
    const endMatch = full.match(MARKERS.END);
    const end = endMatch ? endMatch[1].toLowerCase() : null;
    const flagMatch = full.match(MARKERS.FLAG);
    const flag = flagMatch ? flagMatch[1].trim() : null;
    const followUpMatch = full.match(MARKERS.FOLLOWUP);
    const followUp = followUpMatch ? followUpMatch[1].trim() : null;

    const cleanFull = stripMarkers(full).trim();
    this.addAssistant(cleanFull);

    if (transfer) this.wantsTransfer = true;
    if (end) this.outcome = end;
    if (flag) this.flags.push(flag);
    if (followUp) this.followUps.push(followUp);

    return { text: cleanFull, transfer, end, flag, followUp };
  }
}

function stripMarkers(text) {
  return text
    .replace(/\[TRANSFER\]/gi, '')
    .replace(/\[END:[a-z_]+\]/gi, '')
    .replace(/\[FLAG:[^\]]+\]/gi, '')
    .replace(/\[FOLLOWUP:[^\]]+\]/gi, '');
}

export { stripMarkers, MARKERS, llmConfig };
