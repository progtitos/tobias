import "server-only";
import type { z } from "zod";
import { withGemini, TEXT_MODEL, VISION_MODEL, AIUnavailableError } from "./client";

export type ChatTurn = { role: "user" | "model"; text: string };

type TextParams = {
  system: string;
  history?: ChatTurn[];
  message: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Enable Gemini's web-grounding tool (used only by the Research Agent). */
  grounding?: boolean;
};

function toContents(history: ChatTurn[] | undefined, message: string) {
  return [
    ...(history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user" as const, parts: [{ text: message }] },
  ];
}

/** Plain conversational text generation — used for chat, onboarding replies, insight prose. */
export async function generateText(params: TextParams): Promise<string> {
  const { system, history, message, temperature = 0.6, maxOutputTokens = 1024, grounding } = params;

  const text = await withGemini(async (ai) => {
    const result = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: toContents(history, message),
      config: {
        systemInstruction: system,
        temperature,
        maxOutputTokens,
        ...(grounding ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });
    return result.text;
  });

  if (!text) throw new AIUnavailableError("O Tobias não retornou uma resposta.");
  return text.trim();
}

type JSONParams<T> = {
  system: string;
  history?: ChatTurn[];
  message: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
};

/**
 * Structured extraction: asks Gemini to answer strictly as JSON matching
 * `jsonSchema`, then validates the result against `zodSchema` before
 * returning it. If the model returns malformed JSON or something that fails
 * validation, we retry once with a stricter reminder — and if that still
 * fails, we throw rather than hand the caller unvalidated data (spec rule:
 * never fake certainty / never fabricate structured facts).
 */
export async function generateJSON<T>(params: JSONParams<T>): Promise<T> {
  const { system, history, message, jsonSchema, zodSchema, temperature = 0.2, maxOutputTokens = 2048 } = params;

  const attempt = async (extraInstruction?: string) =>
    withGemini(async (ai) => {
      const result = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: toContents(history, extraInstruction ? `${message}\n\n${extraInstruction}` : message),
        config: {
          systemInstruction: system,
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });
      return result.text;
    });

  let raw = await attempt();
  for (let i = 0; i < 2; i++) {
    if (!raw) {
      raw = await attempt("Responda apenas com o JSON válido pedido, sem texto adicional.");
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      return zodSchema.parse(parsed);
    } catch (err) {
      if (i === 1) {
        console.error("[ai] structured output failed validation", err, raw);
        throw new AIUnavailableError("O Tobias não conseguiu estruturar essa resposta com segurança.");
      }
      raw = await attempt("Sua resposta anterior não era um JSON válido no formato pedido. Tente novamente, respondendo APENAS com o JSON.");
    }
  }
  throw new AIUnavailableError();
}

type VisionJSONParams<T> = Omit<JSONParams<T>, "history"> & {
  images: { mimeType: string; base64: string }[];
};

/** Structured extraction from one or more images (receipt OCR). */
export async function generateVisionJSON<T>(params: VisionJSONParams<T>): Promise<T> {
  const { system, message, images, jsonSchema, zodSchema, temperature = 0.1, maxOutputTokens = 2048 } = params;

  const parts = [
    { text: message },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
  ];

  const attempt = async () =>
    withGemini(async (ai) => {
      const result = await ai.models.generateContent({
        model: VISION_MODEL,
        contents: [{ role: "user" as const, parts }],
        config: {
          systemInstruction: system,
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });
      return result.text;
    });

  let raw = await attempt();
  for (let i = 0; i < 2; i++) {
    try {
      if (!raw) throw new Error("empty response");
      const parsed = JSON.parse(raw);
      return zodSchema.parse(parsed);
    } catch (err) {
      if (i === 1) {
        console.error("[ai] vision structured output failed", err, raw);
        throw new AIUnavailableError("Não consegui ler essa imagem com segurança.");
      }
      raw = await attempt();
    }
  }
  throw new AIUnavailableError();
}
