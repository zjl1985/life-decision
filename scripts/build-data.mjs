#!/usr/bin/env node
// 从 eternity4719/HowToLiveBetter（CC BY 4.0）下载 book/*.md，解析成 src/data/items.json 与 src/data/chapters.json。
// 用法：pnpm data            （从 GitHub 下载）
//       pnpm data -- --local /path/to/book   （用本地目录）
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "eternity4719/HowToLiveBetter";
const BRANCH = "main";
const SITE = "https://eternity4719.github.io/HowToLiveBetter/";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "src", "data");

const FIELD_RE = /^- (成本|说人话|收益|证据等级|来源|备注)：\s*(.*)$/;

async function fetchWithRetry(url, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "User-Agent": "life-decision-build-data",
          // 有 GITHUB_TOKEN（如在 GitHub Actions 里）就带上，避免 API 匿名限流；只发给 api.github.com
          ...(process.env.GITHUB_TOKEN && new URL(url).hostname === "api.github.com"
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
          ...(init.headers || {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 800 * 2 ** (i - 1)));
    }
  }
}

async function loadFiles() {
  const localIdx = process.argv.indexOf("--local");
  if (localIdx !== -1) {
    const dir = process.argv[localIdx + 1];
    const names = (await readdir(dir)).filter((n) => /^\d+-.*\.md$/.test(n)).sort();
    return Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(dir, name), "utf8") })));
  }
  const listRes = await fetchWithRetry(`https://api.github.com/repos/${REPO}/contents/book?ref=${BRANCH}`);
  const list = (await listRes.json())
    .filter((f) => f.type === "file" && /^\d+-.*\.md$/.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const f of list) {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/book/${encodeURIComponent(f.name)}`;
    const text = await (await fetchWithRetry(url)).text();
    files.push({ name: f.name, text });
  }
  return files;
}

// GitHub 标题锚点：小写、去掉标点（保留字母数字含中文、空格、连字符、下划线），空格变连字符
function githubSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

function stripMd(s) {
  return s
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSources(raw) {
  // 每条来源以 <url> 结尾，用尖括号链接作分界；括号里的补充说明（如「网页存档」）并入前一条
  const sources = [];
  const re = /<(https?:\/\/[^>\s]+)>/g;
  let last = 0;
  let m;
  const clean = (t) =>
    stripMd(t)
      .replace(/^[\s;；,，。]+/, "")
      .replace(/[\s;；,，.。]+$/, "")
      .trim();
  while ((m = re.exec(raw))) {
    let seg = raw.slice(last, m.index);
    // 上一条链接后紧跟的括号说明
    const paren = seg.match(/^\s*([（(][^）)]*[）)])/);
    if (paren && sources.length) {
      sources[sources.length - 1].title += " " + paren[1];
      seg = seg.slice(paren[0].length);
    }
    const title = clean(seg);
    if (!title && sources.length) {
      sources.push({ title: `${sources[sources.length - 1].title}（另一链接）`, url: m[1] });
    } else {
      sources.push({ title: title || m[1], url: m[1] });
    }
    last = m.index + m[0].length;
  }
  let rest = raw.slice(last);
  const paren = rest.match(/^\s*([（(][^）)]*[）)])/);
  if (paren && sources.length) {
    sources[sources.length - 1].title += " " + paren[1];
    rest = rest.slice(paren[0].length);
  }
  let tail = clean(rest);
  if (/^[)）」\]\s]*$/.test(tail)) tail = "";
  const looksLikeCitation = /[(（]\d{4}/.test(tail);
  if (tail && sources.length && !looksLikeCitation) {
    // 链接后面的原文摘录/条款说明，作为上一条来源的摘录
    const prev = sources[sources.length - 1];
    prev.excerpt = tail.length > 220 ? tail.slice(0, 218) + "…" : tail;
  } else if (tail) {
    // 没有链接的来源（如裸 URL 或纯文字出处）
    const bare = tail.match(/https?:\/\/[^\s<>()（）]+/);
    sources.push({ title: clean(tail.replace(/https?:\/\/[^\s<>()（）]+/g, "")) || tail, url: bare ? bare[0] : null });
  }
  for (const s of sources) if (s.title.length > 220) s.title = s.title.slice(0, 218) + "…";
  return sources;
}

function parseTags(line) {
  const tags = {};
  const m = line.match(/成本标签:\s*(.*?)\s*-->/);
  if (!m) return null;
  for (const kv of m[1].split(/\s+/)) {
    const [k, v] = kv.split("=");
    if (k && v) tags[k] = v;
  }
  return {
    money: tags["钱"] ?? null,
    time: tags["时间"] ?? null,
    willpower: tags["毅力"] ?? null,
    gain: tags["收益"] ?? null,
    metric: tags["口径"] ?? null,
  };
}

function parseFile(name, text) {
  const lines = text.split(/\r?\n/);
  const chapter = Number(name.match(/^(\d+)-/)[1]);
  const h1 = lines.find((l) => /^# \d+\.\s/.test(l));
  const chapterTitle = h1 ? h1.replace(/^# \d+\.\s*/, "").trim() : name.replace(/^\d+-|\.md$/g, "");
  const shortTitle = name.replace(/^\d+-|\.md$/g, "");
  // 章节导语：一级标题后第一段正文
  let intro = "";
  if (h1) {
    for (let i = lines.indexOf(h1) + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) { if (intro) break; continue; }
      if (/^#/.test(l)) break;
      intro += l;
    }
  }
  const githubFile = `https://github.com/${REPO}/blob/${BRANCH}/book/${encodeURIComponent(name)}`;
  const items = [];
  let cur = null;
  let lastField = null;
  const flush = () => { if (cur) items.push(cur); cur = null; lastField = null; };
  for (const line of lines) {
    const h3 = line.match(/^###\s+(\d+)\.\s*(.+?)\s*$/);
    if (h3) {
      flush();
      const number = Number(h3[1]);
      cur = {
        id: `${chapter}-${number}`,
        chapter,
        chapterTitle,
        chapterShortTitle: shortTitle,
        number,
        title: stripMd(h3[2]),
        body: "",
        cost: "",
        benefit: "",
        evidence: null,
        evidenceNote: null,
        note: "",
        sources: [],
        tags: null,
        url: `${SITE}#e-${chapter}-${number}`,
        githubUrl: `${githubFile}#${githubSlug(line.replace(/^###\s+/, ""))}`,
        _raw: {},
      };
      continue;
    }
    if (!cur) continue;
    if (/^#{1,2}\s/.test(line)) { flush(); continue; }
    if (/^<!--\s*成本标签/.test(line)) { cur.tags = parseTags(line); continue; }
    const f = line.match(FIELD_RE);
    if (f) {
      lastField = f[1];
      cur._raw[lastField] = f[2];
      continue;
    }
    if (lastField && line.trim()) cur._raw[lastField] += "\n" + line.trim(); // 容错：字段跨行
  }
  flush();
  for (const it of items) {
    const r = it._raw;
    it.body = stripMd(r["说人话"] ?? "");
    it.cost = stripMd(r["成本"] ?? "");
    it.benefit = stripMd(r["收益"] ?? "");
    it.note = stripMd(r["备注"] ?? "");
    const ev = (r["证据等级"] ?? "").trim();
    const em = ev.match(/^([ABC])/i);
    it.evidence = em ? em[1].toUpperCase() : null;
    const noteM = ev.match(/^[ABC]\s*[（(](.+?)[)）]/i);
    it.evidenceNote = noteM ? noteM[1] : null;
    it.sources = parseSources(r["来源"] ?? "");
    delete it._raw;
  }
  return { chapter: { chapter, title: chapterTitle, shortTitle, intro: stripMd(intro), file: name, url: githubFile, count: items.length }, items };
}

const files = await loadFiles();
const chapters = [];
const items = [];
for (const { name, text } of files) {
  const { chapter, items: its } = parseFile(name, text);
  chapters.push(chapter);
  items.push(...its);
}

// 校验：上游格式变了、下载不完整时宁可失败，也不覆盖现有数据
const problems = [];
const ids = new Set();
for (const it of items) {
  if (ids.has(it.id)) problems.push(`重复 id ${it.id}`);
  ids.add(it.id);
  if (!it.title) problems.push(`${it.id} 缺少标题`);
  if (!it.body) problems.push(`${it.id} 缺少「说人话」`);
  if (!it.cost) problems.push(`${it.id} 缺少「成本」`);
  if (!it.benefit) problems.push(`${it.id} 缺少「收益」`);
  if (!it.evidence) problems.push(`${it.id} 证据等级无法识别`);
  if (!it.sources.length) problems.push(`${it.id} 没有来源`);
}

async function readPrevious(file) {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, file), "utf8"));
  } catch {
    return null;
  }
}
const prevItems = await readPrevious("items.json");
const prevChapters = await readPrevious("chapters.json");
const prevCount = Array.isArray(prevItems) ? prevItems.length : 0;
const prevChapterCount = Array.isArray(prevChapters) ? prevChapters.length : 0;

const MIN_ITEMS = 500; // 原书 671 条，远低于这个数说明解析坏了
const fatal = [];
if (items.length < MIN_ITEMS) fatal.push(`只解析出 ${items.length} 条（下限 ${MIN_ITEMS}）`);
if (prevCount && items.length < prevCount * 0.9)
  fatal.push(`条目数从 ${prevCount} 掉到 ${items.length}，减少超过 10%`);
if (prevChapterCount && chapters.length < prevChapterCount)
  fatal.push(`章节数从 ${prevChapterCount} 变成 ${chapters.length}`);
const emptyChapters = chapters.filter((c) => c.count === 0).map((c) => c.file);
if (emptyChapters.length) fatal.push(`这些章节一条都没解析出来：${emptyChapters.join("、")}`);
if (problems.length > Math.max(10, items.length * 0.02))
  fatal.push(`字段缺失/无法识别的问题有 ${problems.length} 个，超过 2%`);

const byEv = items.reduce((a, it) => ((a[it.evidence ?? "null"] = (a[it.evidence ?? "null"] || 0) + 1), a), {});
const summary = `${chapters.length} 节，${items.length} 条；证据等级分布 ${JSON.stringify(byEv)}；来源链接 ${items.reduce((n, it) => n + it.sources.filter((s) => s.url).length, 0)} 条`;
if (problems.length) console.warn(`有 ${problems.length} 个问题：\n` + problems.slice(0, 30).join("\n"));
if (fatal.length) {
  console.error(`解析结果不可信，未写入任何文件（${summary}）：\n- ` + fatal.join("\n- "));
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, "items.json"), JSON.stringify(items, null, 1) + "\n");
await writeFile(path.join(OUT_DIR, "chapters.json"), JSON.stringify(chapters, null, 1) + "\n");
console.log(`解析完成：${summary}${prevCount ? `（之前 ${prevCount} 条）` : ""}`);
