# 人生决策

写下你的处境或问题（中文），网站会从《[高性价比人生指南](https://github.com/eternity4719/HowToLiveBetter)》的 671 条建议里，挑出 3–5 条最划算、最贴切的，每条附上原文、证据等级（A/B/C）、成本与收益，以及出处（第几节第几条 + 原始文献链接）。

排序由 TypeSafe AI 的决策模型 **Jev** 完成：它不生成文字，只回答带概率的结构化问题，所以展示给你的永远是书里的原文。

## 工作原理

1. **判断章节**：用 Jev 的 `choice` 问题判断你的处境属于书里 34 节中的哪几节（同时用一个 `noul` 问题过滤明显无关的输入）。
2. **预筛候选**：在最可能的 1–3 节里，用中文单字/二元组重叠打分挑候选，再补上全书范围词法最相关的几条，共约 30 条。
3. **逐条打分**：一次 Jev 请求里给每条候选一个 `score` 问题（5 级：这条建议对你的处境有多适用）。
4. **综合排序**：适用度 × 证据权重（A=1、B=0.8、C=0.6）× 轻微的性价比修正（花钱少、收益大的略靠前），返回前 3–5 条。

两次 Jev 请求一般合计 0.3–1 秒。所有模型调用都在服务端路由 `src/app/api/advise/route.ts` 里完成，密钥不会发到浏览器。

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 说明 |
| --- | --- |
| `TYPESAFE_API_KEY` | TypeSafe 官方 API 密钥（[console.typesafe.ai](https://console.typesafe.ai)），优先使用 |
| `OPENROUTER_API_KEY` | 可选：没有 TypeSafe 密钥时，改走 OpenRouter 的 `typesafe/jev-1.13` |
| `JEV_MODEL` | 模型版本，默认 `jev-1.13.0` |

## 本地开发

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

其他命令：

```bash
pnpm build      # 生产构建
pnpm lint       # 代码检查
pnpm data       # 重新从 GitHub 下载书稿并生成 src/data/items.json、chapters.json
```

`src/data/*.json` 已经提交到仓库，构建时不需要联网下载书稿；原书更新后运行 `pnpm data` 再提交即可。

## 部署到 Vercel

1. 把仓库推到 GitHub（已完成）。
2. 在 [vercel.com/new](https://vercel.com/new) 导入该仓库，框架会自动识别为 Next.js，包管理器为 pnpm，构建命令保持默认。
3. 在 Project → Settings → Environment Variables 里添加 `TYPESAFE_API_KEY`（或 `OPENROUTER_API_KEY`），按需添加 `JEV_MODEL`。
4. 点击 Deploy。之后每次推送到 `main` 都会自动部署。

## 许可与致谢

- 作者：[zero](https://github.com/zjl1985)。
- 建议内容来自 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans) 许可使用；本项目只做检索与排序，未改动原意。
- 决策模型：Jev by [TypeSafe AI](https://typesafe.ai)。
- 本站内容仅供参考，不构成医疗、法律或财务方面的专业意见。
