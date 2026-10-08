export type Evidence = "A" | "B" | "C";

export type Source = { title: string; url: string | null; excerpt?: string };

export type Item = {
  id: string;
  chapter: number;
  chapterTitle: string;
  chapterShortTitle: string;
  number: number;
  title: string;
  body: string;
  cost: string;
  benefit: string;
  evidence: Evidence | null;
  evidenceNote: string | null;
  note: string;
  sources: Source[];
  tags: { money: string | null; time: string | null; willpower: string | null; gain: string | null; metric: string | null } | null;
  url: string;
  githubUrl: string;
};

export type Chapter = {
  chapter: number;
  title: string;
  shortTitle: string;
  intro: string;
  file: string;
  url: string;
  count: number;
};

export type AdviceResult = {
  rank: number;
  id: string;
  chapter: number;
  chapterTitle: string;
  number: number;
  title: string;
  body: string;
  cost: string;
  benefit: string;
  evidence: Evidence | null;
  evidenceNote: string | null;
  sources: Source[];
  url: string;
  githubUrl: string;
  applicability: number; // 0–1，Jev 打分归一化
  score: number; // 综合分
};

export type AdviseResponse =
  | {
      ok: true;
      results: AdviceResult[];
      chapters: { chapter: number; title: string; probability: number }[];
      lowRelevance: boolean;
      meta: { model: string; candidates: number; ms: number };
    }
  | { ok: false; error: string };
