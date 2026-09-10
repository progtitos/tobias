import "server-only";
import { GoogleGenAI } from "@google/genai";

// ============================================================================
// Low-level Gemini client with multi-key rotation.
// ----------------------------------------------------------------------------
// GEMINI_API_KEYS is a comma-separated list. We rotate across all of them —
// round-robin on every call, and fail over to the next key mid-request if one
// comes back rate-limited (429) or has a transient server error (5xx). A
// genuinely bad request (400, safety block) is NOT retried with a different
// key — retrying that just burns quota for the same guaranteed failure.
// ============================================================================

const RAW_KEYS = (process.env.GEMINI_API_KEYS ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

// gemini-2.0-flash was retired by Google (404 "no longer available") —
// gemini-3.6-flash is the current flash model and, like its predecessor,
// natively multimodal (text + image), so one model covers both use cases.
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
export const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-3.6-flash";

export function isAIConfigured() {
  return RAW_KEYS.length > 0;
}

let cursor = 0;
function orderedKeysForThisCall(): string[] {
  if (RAW_KEYS.length === 0) return [];
  const start = cursor % RAW_KEYS.length;
  cursor++;
  return [...RAW_KEYS.slice(start), ...RAW_KEYS.slice(0, start)];
}

function isRetryableError(err: unknown): boolean {
  const status =
    (err as { status?: number; response?: { status?: number } })?.status ??
    (err as { response?: { status?: number } })?.response?.status;
  if (typeof status === "number") {
    return status === 429 || status >= 500;
  }
  // Network-level failures (timeouts, DNS, etc.) are worth a retry too.
  const message = String((err as Error)?.message ?? err ?? "");
  return /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(message);
}

export class AIUnavailableError extends Error {
  constructor(message = "O Tobias não conseguiu falar com o provedor de IA agora.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/**
 * Runs `fn` against a fresh GoogleGenAI client, rotating through every
 * configured API key until one succeeds or all have failed with a retryable
 * error. Throws AIUnavailableError (never a raw SDK error) so callers always
 * get a predictable, user-safe failure mode — per the product rule "never
 * fake that an integration worked."
 */
export async function withGemini<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = orderedKeysForThisCall();
  if (keys.length === 0) {
    throw new AIUnavailableError("Nenhuma chave de IA configurada (GEMINI_API_KEYS).");
  }

  let lastError: unknown;
  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      return await fn(ai);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) throw err;
      // otherwise: try the next key
    }
  }
  console.error("[ai] all Gemini keys exhausted", lastError);
  throw new AIUnavailableError();
}
