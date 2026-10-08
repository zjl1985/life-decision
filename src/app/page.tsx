import Advisor from "@/components/Advisor";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
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
            许可使用，本站仅做检索与排序，未改动原意。
          </p>
          <p>本站内容仅供参考，不构成医疗、法律或财务方面的专业意见；遇到具体问题，请咨询医生、律师或持牌专业人士。</p>
          <p>
            Powered by{" "}
            <a
              className="underline decoration-border underline-offset-4 hover:text-foreground"
              href="https://typesafe.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jev
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
