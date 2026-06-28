/**
 * 本地模型客户端（OpenAI 兼容 + 确定性 fallback）。
 *
 * 默认连本机 Ollama（http://localhost:11434/v1）。探测不到端点/超时/JSON 不合法 → 返回 null，
 * 调用方降级到 model-free 路径。**AI 永远是增益，不是依赖**（设计文档 §6.2）。
 *
 * env: OPENAI_BASE_URL（默认 http://localhost:11434/v1）、HP_AI_MODEL（默认 qwen3:4b-instruct）、
 *      HP_AI_TIMEOUT_MS（默认 20000）。
 */
import { validate, type Schema } from "./lib/miniSchema";

const BASE = process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1";
const MODEL = process.env.HP_AI_MODEL ?? "qwen3:4b-instruct";
const TIMEOUT = Number(process.env.HP_AI_TIMEOUT_MS ?? 20000);

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await p(ctrl.signal); } catch { return null; } finally { clearTimeout(timer); }
}

/** 快速探测本地端点是否可用（短超时）。 */
export async function isModelAvailable(): Promise<boolean> {
  const r = await withTimeout(async (signal) => {
    const res = await fetch(`${BASE}/models`, { signal });
    return res.ok;
  }, 1500);
  return r === true;
}

/**
 * 让模型产出**符合 schema 的 JSON**。语法/格式不对就回灌错误重试（≤retries）。
 * 端点不可达/全部失败 → 返回 null（调用方走 fallback）。
 */
export async function chatJson<T = unknown>(
  messages: ChatMessage[],
  schema: Schema,
  opts: { retries?: number; temperature?: number } = {},
): Promise<T | null> {
  const retries = opts.retries ?? 2;
  let convo = [...messages];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const out = await withTimeout(async (signal) => {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: MODEL,
          messages: convo,
          temperature: opts.temperature ?? 0.7,
          response_format: { type: "json_object" }, // 约束 JSON；Ollama/兼容端点支持
          stream: false,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.choices?.[0]?.message?.content as string | undefined;
    }, TIMEOUT);

    if (!out) return null; // 端点不可达/超时 → fallback
    let parsed: unknown;
    try { parsed = JSON.parse(out); } catch {
      convo = [...convo, { role: "assistant", content: out }, { role: "user", content: "输出不是合法 JSON。只返回 JSON 对象，不要任何解释。" }];
      continue;
    }
    const errors = validate(schema, parsed);
    if (errors.length === 0) return parsed as T;
    convo = [...convo, { role: "assistant", content: out }, { role: "user", content: "JSON 不符合 schema：\n" + errors.map((e) => `${e.path}: ${e.message}`).join("\n") + "\n按要求重出。" }];
  }
  return null;
}

export const MODEL_INFO = { base: BASE, model: MODEL, timeout: TIMEOUT };
