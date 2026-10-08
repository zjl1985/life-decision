import "server-only";

// Jev（TypeSafe AI）决策模型的最小客户端。只在服务端使用，密钥不会进入浏览器。
// 官方：POST https://api.typesafe.ai/v1/systemone
// 备选：POST https://openrouter.ai/api/alpha/decisions（model: typesafe/jev-1.13）

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};
export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[]; // 从低到高，2–10 个等级
};
export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number; // 概率加权，0 … 等级数-1
  legend?: Record<string, string>;
  probabilities: Record<string, number>;
  confidence?: number;
};
export type NoulAnswer = { type: "noul"; noul: number };
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type JevResponse = {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens: number; output_tokens: number };
};

export class JevError extends Error {
  constructor(
    public code: "no_key" | "unauthorized" | "invalid" | "rate_limited" | "overloaded" | "timeout" | "network" | "upstream",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "JevError";
  }
}

type Provider = { name: "typesafe" | "openrouter"; url: string; key: string; model: string };

function provider(): Provider {
  const typesafeKey = process.env.TYPESAFE_API_KEY?.trim();
  if (typesafeKey) {
    return {
      name: "typesafe",
      url: "https://api.typesafe.ai/v1/systemone",
      key: typesafeKey,
      model: process.env.JEV_MODEL?.trim() || "jev-1.13.0",
    };
  }
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    return {
      name: "openrouter",
      url: "https://openrouter.ai/api/alpha/decisions",
      key: orKey,
      model: process.env.OPENROUTER_JEV_MODEL?.trim() || "typesafe/jev-1.13",
    };
  }
  throw new JevError("no_key", "缺少 TYPESAFE_API_KEY 或 OPENROUTER_API_KEY");
}

export function hasJevKey(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askJev(
  state: string | Record<string, unknown>,
  questions: Record<string, Question>,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<JevResponse> {
  const p = provider();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxRetries = opts.maxRetries ?? 2;
  const body = JSON.stringify({ model: p.model, state, questions });

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(p.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (attempt < maxRetries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw new JevError(isTimeout ? "timeout" : "network", isTimeout ? "Jev 请求超时" : "无法连接 Jev 服务");
    }

    if (res.ok) {
      const data = (await res.json()) as JevResponse;
      if (!data || typeof data !== "object" || !data.answers) {
        throw new JevError("upstream", "Jev 返回了无法识别的结果", res.status);
      }
      return data;
    }

    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new JevError("unauthorized", "Jev API 密钥无效", res.status);
    }
    if (res.status === 422 || res.status === 400) {
      console.error("[jev] validation error:", text.slice(0, 500));
      throw new JevError("invalid", "Jev 请求校验失败", res.status);
    }
    if (res.status === 429 && attempt < maxRetries) {
      const ra = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt;
      if (waitMs <= 8000) {
        await sleep(waitMs);
        continue;
      }
    }
    if ((res.status === 529 || res.status >= 500) && attempt < maxRetries) {
      await sleep(600 * 2 ** attempt + Math.random() * 300);
      continue;
    }
    if (res.status === 429) throw new JevError("rate_limited", "Jev 限流", res.status);
    if (res.status === 529) throw new JevError("overloaded", "Jev 服务繁忙", res.status);
    console.error("[jev] upstream error", res.status, text.slice(0, 300));
    throw new JevError("upstream", `Jev 服务出错（${res.status}）`, res.status);
  }
}
