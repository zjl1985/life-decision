import Advisor from "@/components/Advisor";

const REPO_URL = "https://github.com/zjl1985/life-decision";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="在 GitHub 上查看本站源码"
        title="本站源码"
        className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-subtle transition-colors hover:bg-border/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:top-6 sm:right-6"
      >
        <GitHubIcon className="h-5 w-5" />
      </a>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-16 pb-12 sm:pt-24">
        <header className="mb-10 text-center sm:mb-12">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] text-accent">LIFE · DECISION</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">人生决策</h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-muted">
            写下你的处境，从 671 条有证据分级的建议里，挑出最划算、最贴切的几条。
          </p>
        </header>
        <Advisor />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-2xl space-y-2 px-5 py-8 text-center text-xs leading-6 text-subtle">
          <p>
            建议内容来自{" "}
            <a
              className="underline decoration-border underline-offset-4 hover:text-foreground"
              href="https://github.com/eternity4719/HowToLiveBetter"
              target="_blank"
              rel="noopener noreferrer"
            >
              eternity4719/HowToLiveBetter
            </a>
            《高性价比人生指南》，按{" "}
            <a
              className="underline decoration-border underline-offset-4 hover:text-foreground"
              href="https://creativecommons.org/licenses/by/4.0/deed.zh-hans"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>{" "}
            许可使用，本站仅做检索与排序，未改动原意。建议的适用度由{" "}
            <a
              className="underline decoration-border underline-offset-4 hover:text-foreground"
              href="https://typesafe.ai/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jev 模型
            </a>
            打分。
          </p>
          <p>本站内容仅供参考，不构成医疗、法律或财务方面的专业意见；遇到具体问题，请咨询医生、律师或持牌专业人士。</p>
          <p className="pt-3 text-[13px] text-muted">
            Made by{" "}
            <a
              className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              href="https://github.com/zjl1985"
              target="_blank"
              rel="noopener noreferrer"
            >
              zero
            </a>
            <span className="mx-2 text-border">·</span>
            <a
              className="inline-flex items-center gap-1.5 text-xs text-subtle underline decoration-border underline-offset-4 hover:text-foreground"
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              本站源码
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
