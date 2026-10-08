import "server-only";

import chaptersData from "@/data/chapters.json";
import itemsData from "@/data/items.json";

import { CHAPTER_EN } from "./chapters-en";
import { askJev, type ChoiceAnswer, type NoulAnswer, type Question, type ScoreAnswer } from "./jev";
import { lexicalScores } from "./retrieve";
import type { AdviceResult, Chapter, Item } from "./types";

const ITEMS = itemsData as Item[];
const CHAPTERS = chaptersData as Chapter[];
const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

const EVIDENCE_WEIGHT: Record<string, number> = { A: 1, B: 0.8, C: 0.6 };
// 性价比微调：同样适用时，花钱少、收益大的略靠前（书里各节本身也按性价比排序）
const MONEY_WEIGHT: Record<string, number> = { "0": 1, 少: 0.97, 中: 0.95, 多: 0.92 };
const GAIN_WEIGHT: Record<string, number> = { 大: 1, 中: 0.96, 小: 0.9 };

const MAX_CANDIDATES = 30;
const SCORE_LEVELS = [
  "Not applicable: unrelated to the person's situation",
  "Barely applicable: same broad topic but does not help with this situation",
  "Somewhat applicable: partly relevant, useful background",
  "Applicable: clearly relevant and actionable for this situation",
  "Highly applicable: directly addresses the person's situation; one of the first things they should do or know",
];

export class AdviseInputError extends Error {}

export type AdviseOutput = {
  results: AdviceResult[];
  chapters: { chapter: number; title: string; probability: number }[];
  lowRelevance: boolean;
  offTopic: boolean;
  model: string;
  candidates: number;
};

function chapterQuestions(): Record<string, Question> {
  const criteria: Record<string, string> = {};
  for (const c of CHAPTERS) criteria[`c${c.chapter}`] = CHAPTER_EN[c.chapter] ?? c.title;
  return {
    chapter: {
      type: "choice",
      instructions:
        "The state is a person's own description (in Chinese) of their situation, decision or question. Which section of a practical, evidence-based life guide (written for people in mainland China) best matches what they need help with?",
      criteria,
    },
    on_topic: {
      type: "noul",
      instructions:
        "The text describes a real personal situation, decision or question about life (health, safety, money, law, work, family, relationships, education, emergencies, daily life) that practical advice could help with.",
    },
  };
}

function adviceText(it: Item) {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
  return `【${it.title}】${clip(it.body, 220)}（成本：${clip(it.cost, 60)}）`;
}

function pickCandidates(query: string, chapterProbs: Map<number, number>): Item[] {
  const lex = lexicalScores(ITEMS, query);
  const ranked = [...chapterProbs.entries()].sort((a, b) => b[1] - a[1]);
  const chosen: [number, number][] = [];
  let cum = 0;
  for (const [ch, p] of ranked) {
    if (chosen.length >= 3) break;
    if (chosen.length > 0 && p < 0.05) break;
    if (chosen.length > 0 && cum >= 0.9 && p < 0.1) break;
    chosen.push([ch, p]);
    cum += p;
  }

  const picked = new Map<string, Item>();
  const chapterBudget = MAX_CANDIDATES - 8; // 剩下的留给全书词法命中
  const totalP = chosen.reduce((s, [, p]) => s + p, 0) || 1;
  for (const [ch, p] of chosen) {
    const slots = Math.max(6, Math.round((chapterBudget * p) / totalP));
    const pool = ITEMS.filter((it) => it.chapter === ch);
    const count = pool.length;
    pool
      .map((it) => ({ it, s: (lex.get(it.id) ?? 0) + 0.12 * (1 - (it.number - 1) / count) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, slots)
      .forEach(({ it }) => picked.set(it.id, it));
  }
  // 全书范围内词法最相关的几条（话题常常跨节）
  const global = [...lex.entries()]
    .filter(([id, s]) => s >= 0.2 && !picked.has(id))
    .sort((a, b) => b[1] - a[1]);
  for (const [id] of global) {
    if (picked.size >= MAX_CANDIDATES) break;
    picked.set(id, BY_ID.get(id)!);
  }
  return [...picked.values()].slice(0, MAX_CANDIDATES + 4);
}

export async function advise(rawQuery: string): Promise<AdviseOutput> {
  const query = rawQuery.trim();
  if (query.length < 4) throw new AdviseInputError("请多写几个字，描述一下你的处境或问题。");
  if (query.length > 800) throw new AdviseInputError("内容有点长，请精简到 800 字以内。");
  const state = { situation: query };

  // 1. 先判断属于哪一节
  const first = await askJev(state, chapterQuestions());
  const chAns = first.answers.chapter as ChoiceAnswer;
  const onTopic = (first.answers.on_topic as NoulAnswer | undefined)?.noul ?? 1;
  const chapterProbs = new Map<number, number>();
  for (const [k, p] of Object.entries(chAns.probabilities ?? {})) chapterProbs.set(Number(k.slice(1)), p);
  const topChapters = [...chapterProbs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([chapter, probability]) => ({
      chapter,
      title: CHAPTERS.find((c) => c.chapter === chapter)?.title ?? "",
      probability,
    }));

  if (onTopic < 0.12) {
    return { results: [], chapters: topChapters, lowRelevance: true, offTopic: true, model: first.model, candidates: 0 };
  }

  // 2. 预筛候选
  const candidates = pickCandidates(query, chapterProbs);

  // 3. 一次请求里给每条候选一个 score 问题
  const questions: Record<string, Question> = {};
  for (const it of candidates) {
    questions[`i${it.id.replace("-", "_")}`] = {
      type: "score",
      instructions: `The state is a person's description (in Chinese) of their situation or question. How applicable and useful is the following piece of advice (in Chinese) for this specific person right now? Advice: ${adviceText(it)}`,
      criteria: SCORE_LEVELS,
    };
  }
  const second = await askJev(state, questions, { timeoutMs: 20000 });

  // 4. 排序：适用度 × 证据权重 × 性价比微调
  const maxLevel = SCORE_LEVELS.length - 1;
  const scored = candidates
    .map((it) => {
      const a = second.answers[`i${it.id.replace("-", "_")}`] as ScoreAnswer | undefined;
      const applicability = a && typeof a.score === "number" ? Math.min(1, Math.max(0, a.score / maxLevel)) : 0;
      const ev = it.evidence ? EVIDENCE_WEIGHT[it.evidence] : 0.5;
      const money = MONEY_WEIGHT[it.tags?.money ?? ""] ?? 0.96;
      const gain = GAIN_WEIGHT[it.tags?.gain ?? ""] ?? 0.96;
      return { it, applicability, score: applicability * ev * money * gain };
    })
    .sort((a, b) => b.score - a.score || a.it.number - b.it.number);

  // 最相关的一条都几乎不适用：说明书里没有对应内容，不硬凑
  if ((scored[0]?.applicability ?? 0) < 0.15) {
    return { results: [], chapters: topChapters, lowRelevance: true, offTopic: false, model: second.model, candidates: candidates.length };
  }
  // 至少 3 条；第 4、5 条要足够相关才放进来
  const top = scored.filter((s, i) => i < 3 || (i < 5 && s.applicability >= 0.55));
  const lowRelevance = (top[0]?.applicability ?? 0) < 0.5;

  const results: AdviceResult[] = top.map(({ it, applicability, score }, i) => ({
    rank: i + 1,
    id: it.id,
    chapter: it.chapter,
    chapterTitle: it.chapterTitle,
    number: it.number,
    title: it.title,
    body: it.body,
    cost: it.cost,
    benefit: it.benefit.length > 180 ? it.benefit.slice(0, 178) + "…" : it.benefit,
    evidence: it.evidence,
    evidenceNote: it.evidenceNote,
    sources: it.sources.slice(0, 4),
    url: it.url,
    githubUrl: it.githubUrl,
    applicability: Math.round(applicability * 100) / 100,
    score: Math.round(score * 1000) / 1000,
  }));

  return {
    results,
    chapters: topChapters,
    lowRelevance,
    offTopic: false,
    model: second.model,
    candidates: candidates.length,
  };
}
