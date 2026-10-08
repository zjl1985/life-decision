"use client";

import { useEffect, useRef, useState } from "react";

import type { AdviceResult, AdviseResponse, Evidence } from "@/lib/types";

const EXAMPLES = [
  "朋友找我给他的贷款做担保，要不要签？",
  "刚被公司裁了，第一步该做什么？",
  "30 岁，要不要买重疾险？",
  "爸妈年纪大了，有哪些事要提前办？",
  "总是熬夜刷手机，第二天没精神",
];

const LOADING_STEPS = ["正在理解你的处境…", "正在翻阅 671 条建议…", "正在逐条比较适用度…"];

const EVIDENCE_STYLE: Record<Evidence, { label: string; cls: string }> = {
  A: { label: "证据 A", cls: "text-[var(--ev-a)] bg-[var(--ev-a-bg)]" },
  B: { label: "证据 B", cls: "text-[var(--ev-b)] bg-[var(--ev-b-bg)]" },
  C: { label: "证据 C", cls: "text-[var(--ev-c)] bg-[var(--ev-c-bg)]" },
};

type Ok = Extract<AdviseResponse, { ok: true }>;

export default function Advisor() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Ok | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, [loading]);

  async function submit(text = query) {
    const q = text.trim();
    if (!q || loading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setStep(0);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => null)) as AdviseResponse | null;
      if (!json) throw new Error("bad");
      if (!json.ok) {
        setError(json.error);
      } else {
        setData(json);
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("网络好像出了点问题，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-border bg-surface p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] transition-shadow focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
      >
        <label htmlFor="query" className="sr-only">
          你的处境或问题
        </label>
        <textarea
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={800}
          rows={5}
          placeholder="说说你遇到了什么事、在纠结什么。比如：朋友让我替他的网贷做担保，说只是走个形式……"
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[16px] leading-7 text-foreground placeholder:text-subtle focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <span className="hidden pl-2 text-xs text-subtle sm:inline">⌘ / Ctrl + Enter 提交</span>
          <span className="pl-2 text-xs text-subtle sm:hidden">{query.length} / 800</span>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-fg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                思考中
              </>
            ) : (
              "给我建议"
            )}
          </button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuery(ex);
              submit(ex);
            }}
            className="rounded-full border border-border px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      <div ref={resultsRef} className="scroll-mt-6 pt-12" aria-live="polite">
        {loading && <Loading step={step} />}
        {error && !loading && (
          <div className="animate-rise rounded-xl border border-border bg-surface px-5 py-4 text-center text-sm leading-6 text-muted">
            {error}
          </div>
        )}
        {data && !loading && <Results data={data} />}
      </div>
    </div>
  );
}

function Loading({ step }: { step: number }) {
  return (
    <div>
      <p className="mb-6 text-center text-sm text-muted">{LOADING_STEPS[step]}</p>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-6" style={{ opacity: 1 - i * 0.25 }}>
            <div className="skeleton mb-4 h-5 w-2/3 rounded" />
            <div className="skeleton mb-2 h-3.5 w-full rounded" />
            <div className="skeleton mb-2 h-3.5 w-11/12 rounded" />
            <div className="skeleton h-3.5 w-3/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Results({ data }: { data: Ok }) {
  if (data.results.length === 0) {
    return (
      <p className="animate-rise rounded-xl border border-border bg-surface px-5 py-4 text-center text-sm leading-6 text-muted">
        书里没有和这个问题直接相关的建议。试着写得具体一些：发生了什么、你在犹豫什么？
      </p>
    );
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 text-xs text-subtle">
        <span>
          最相关的章节：
          {data.chapters
            .filter((c) => c.probability >= 0.05)
            .map((c) => `第 ${c.chapter} 节 ${c.title}`)
            .join("、")}
        </span>
        <span>
          {data.meta.candidates} 条候选 · {(data.meta.ms / 1000).toFixed(1)} 秒
        </span>
      </div>
      {data.lowRelevance && (
        <p className="mb-6 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-6 text-muted">
          书里没有特别贴合你情况的条目，下面是相对最接近的几条，仅供参考。
        </p>
      )}
      <ol className="space-y-5">
        {data.results.map((r, i) => (
          <Card key={r.id} r={r} delay={i * 80} />
        ))}
      </ol>
    </div>
  );
}

function Card({ r, delay }: { r: AdviceResult; delay: number }) {
  const ev = r.evidence ? EVIDENCE_STYLE[r.evidence] : null;
  return (
    <li
      className="animate-rise rounded-2xl border border-border bg-surface p-5 sm:p-7"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex gap-3 sm:gap-4">
        <span className="font-serif text-2xl sm:text-3xl leading-none font-semibold text-accent/80 tabular-nums">{r.rank}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-7 font-semibold text-foreground">{r.title}</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {ev && (
              <span className={`rounded-md px-2 py-0.5 font-medium ${ev.cls}`} title="证据等级：A 最硬，C 最弱">
                {ev.label}
                {r.evidenceNote ? ` · ${r.evidenceNote}` : ""}
              </span>
            )}
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent-soft px-2 py-0.5 text-accent transition-opacity hover:opacity-80"
            >
              第 {r.chapter} 节第 {r.number} 条
            </a>
            <span className="text-subtle">{r.chapterTitle}</span>
            <span className="ml-auto text-subtle" title="Jev 判断的适用程度">
              适用度 {Math.round(r.applicability * 100)}%
            </span>
          </div>

          <p className="mt-4 text-[15px] leading-7 text-foreground/90">{r.body}</p>

          <dl className="mt-4 space-y-2 border-l-2 border-border pl-4 text-sm leading-6">
            <div className="flex gap-3">
              <dt className="shrink-0 text-subtle">成本</dt>
              <dd className="text-muted">{r.cost}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 text-subtle">收益</dt>
              <dd className="text-muted">{r.benefit}</dd>
            </div>
          </dl>

          {r.sources.length > 0 && (
            <details className="group mt-4 text-sm">
              <summary className="cursor-pointer list-none text-xs text-subtle transition-colors select-none hover:text-foreground">
                <span className="inline-block transition-transform group-open:rotate-90">›</span> 来源（{r.sources.length}）
              </summary>
              <ul className="mt-2 space-y-1.5 pl-3 text-xs leading-5">
                {r.sources.map((s, i) => (
                  <li key={i} className="text-muted">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-4 hover:text-accent hover:decoration-accent"
                      >
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 flex gap-4 text-xs">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              在线查看原文 ↗
            </a>
            <a
              href={r.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-subtle hover:text-foreground hover:underline"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
