import type { Item } from "./types";

// 极简的中文字/二元组重叠检索，用来在 Jev 打分前把候选缩到几十条。
const CJK = /[\u3400-\u9fff]/;
const STOP = new Set("的了是我你他她它们在有和就不也都要会吗呢吧啊么这那个一些什么怎么如果可以还是没有因为所以但是自己现在已经应该".split(""));

function tokens(text: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (t: string, w: number) => out.set(t, (out.get(t) ?? 0) + w);
  const s = text.toLowerCase();
  // 拉丁词
  for (const m of s.matchAll(/[a-z0-9]{2,}/g)) add("w:" + m[0], 1);
  // 中文单字 + 二元组
  const runs = s.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) {
      const c = run[i];
      if (!STOP.has(c)) add("u:" + c, 1);
      if (i + 1 < run.length) add("b:" + run.slice(i, i + 2), 1);
    }
  }
  return out;
}

type Doc = { item: Item; tf: Map<string, number> };

let index: { docs: Doc[]; idf: Map<string, number> } | null = null;

function buildIndex(items: Item[]) {
  const docs: Doc[] = items.map((item) => {
    const tf = new Map<string, number>();
    const merge = (text: string, w: number) => {
      for (const [t, n] of tokens(text)) tf.set(t, (tf.get(t) ?? 0) + n * w);
    };
    merge(item.title, 3);
    merge(item.body, 1.5);
    merge(item.cost, 0.6);
    merge(item.benefit, 0.6);
    merge(item.note, 0.4);
    merge(item.chapterTitle, 0.8);
    return { item, tf };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + N / n));
  return { docs, idf };
}

/** 返回每条的词法得分（已按最大值归一到 0–1）。 */
export function lexicalScores(items: Item[], query: string): Map<string, number> {
  if (!index) index = buildIndex(items);
  const q = tokens(query);
  const scores = new Map<string, number>();
  let max = 0;
  for (const d of index.docs) {
    let s = 0;
    for (const [t, qn] of q) {
      const n = d.tf.get(t);
      if (!n) continue;
      const kind = t[0];
      const w = kind === "b" ? 1 : kind === "w" ? 1.2 : 0.25;
      // 饱和的 tf，避免长条目占便宜
      s += w * (idf(t) ?? 1) * (n / (n + 1.5)) * Math.min(qn, 2);
    }
    scores.set(d.item.id, s);
    if (s > max) max = s;
  }
  if (max > 0) for (const [k, v] of scores) scores.set(k, v / max);
  return scores;

  function idf(t: string) {
    return index!.idf.get(t);
  }
}

export function hasCjk(text: string) {
  return CJK.test(text);
}
