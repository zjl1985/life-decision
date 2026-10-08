import { advise, AdviseInputError } from "@/lib/advise";
import { JevError } from "@/lib/jev";
import type { AdviseResponse } from "@/lib/types";

export const maxDuration = 30;

// 尽力而为的内存限流（单实例内有效），防止被刷
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 12;

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > LIMIT;
}

function fail(error: string, status: number) {
  return Response.json({ ok: false, error } satisfies AdviseResponse, { status });
}

const JEV_MESSAGES: Record<JevError["code"], [string, number]> = {
  no_key: ["服务还没配置好（缺少模型 API 密钥），请联系站长。", 503],
  unauthorized: ["模型服务鉴权失败，请联系站长检查 API 密钥。", 502],
  invalid: ["请求没有通过模型校验，请换个说法再试。", 502],
  rate_limited: ["现在问的人有点多，请过几秒再试。", 429],
  overloaded: ["模型服务暂时繁忙，请稍后再试。", 503],
  timeout: ["模型响应超时了，请再试一次。", 504],
  network: ["暂时连不上模型服务，请稍后再试。", 502],
  upstream: ["模型服务出了点问题，请稍后再试。", 502],
};

export async function POST(request: Request) {
  const t0 = Date.now();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (rateLimited(ip)) return fail("提交得太频繁了，请一分钟后再试。", 429);

  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body?.query === "string" ? body.query : "";
  } catch {
    return fail("请求格式不对。", 400);
  }

  try {
    const out = await advise(query);
    if (out.offTopic) {
      return fail("这段话看起来不像是一个具体的处境或问题。试着写写：发生了什么、你在犹豫什么？", 422);
    }
    const payload: AdviseResponse = {
      ok: true,
      results: out.results,
      chapters: out.chapters,
      lowRelevance: out.lowRelevance,
      meta: { model: out.model, candidates: out.candidates, ms: Date.now() - t0 },
    };
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AdviseInputError) return fail(err.message, 400);
    if (err instanceof JevError) {
      const [msg, status] = JEV_MESSAGES[err.code];
      console.error("[advise] jev error:", err.code, err.status ?? "");
      return fail(msg, status);
    }
    console.error("[advise] unexpected error:", err);
    return fail("出了点意外，请稍后再试。", 500);
  }
}
