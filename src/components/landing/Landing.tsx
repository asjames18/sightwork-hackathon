import Link from "next/link";

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary = `inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent-dark px-6 py-3 text-base font-semibold text-white hover:bg-ink ${ring}`;
const steps = [
  {
    title: "Film.",
    body: "Walk the space slowly, edge to edge. Say what needs work if you like. A silent walkthrough works too.",
  },
  {
    title: "SightWork looks.",
    body: "It listens to what you said, studies your walkthrough, counts what's in the room, and checks what you said against what it saw.",
  },
  {
    title: "Get your plan.",
    body: "Usually in about a minute: problems ranked worst first, each with a proof frame from your video, then the steps in the right order and the materials.",
  },
];

/** Said-vs-saw strip from the EXAMPLE plan (src/lib/mock/samplePlan.ts), as agreed in the handoff. */
const matched = [
  { said: "We need more chairs up front.", saw: "Gaps in the front rows" },
  { said: "That light up there is out.", saw: "One dark fixture" },
];

const secondary = `inline-flex min-h-[44px] items-center justify-center rounded-xl border border-ink/20 bg-white/60 px-6 py-3 text-base font-semibold text-ink hover:border-ink/40 ${ring}`;

/**
 * Landing page at /. Static server component, no client JS.
 * Copy is word for word from the agreed Conclusion in the design handoff. Shipped so far: header,
 * hero, how it works, the said-vs-saw band, closing CTA and footer; the remaining middle sections
 * (what you get, who it's for, built on Meta's open models, fine print) follow in later commits.
 */
export function Landing() {
  return (
    <>
      <header className="border-b border-ink/10 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top" className={`-mx-2 flex min-h-11 items-center rounded-lg px-2 text-xl font-extrabold tracking-tight ${ring}`}>
            Sight<span className="text-accent">Work</span>
          </a>
          <Link href="/start" className={`min-h-11 rounded-full border border-ink/20 bg-white/60 px-4 py-2.5 text-sm font-semibold hover:border-ink/40 ${ring}`}>
            Try it
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-6 md:pt-16">
          <h1 className="max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Walk the room. Get the work plan.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">
            Film a 60 to 90 second walkthrough on your phone. SightWork counts what&apos;s there, roughly, finds what needs fixing,
            including the problems you didn&apos;t mention, and lays out the work in order, with proof from your own video.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/start" className={primary}>Film a walkthrough</Link>
            <Link href="/start?view=example" className={secondary}>See an example plan</Link>
          </div>
          <p className="mt-4 text-sm text-ink/70">Free to try in this demo. No account needed.</p>
        </section>

        <section aria-labelledby="how-heading" className="border-t border-ink/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="how-heading" className="text-[28px] font-extrabold leading-tight">How it works</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-ink/10 bg-white p-5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-dark text-base font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-ink/75">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="catch-heading" className="border-t border-ink/10 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="catch-heading" className="max-w-2xl text-[28px] font-extrabold leading-tight">
              You mention five things. SightWork finds three more.
            </h2>
            <ul className="mt-6 grid gap-3">
              {matched.map((row) => (
                <li
                  key={row.said}
                  className="grid gap-2 rounded-2xl border border-ink/10 bg-paper p-4 sm:grid-cols-2 sm:items-center sm:gap-6"
                >
                  <p className="text-base">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink/70">You said</span>
                    &ldquo;{row.said}&rdquo;
                  </p>
                  <p className="text-base">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink/70">SightWork saw</span>
                    {row.saw}
                  </p>
                </li>
              ))}
              <li className="rounded-2xl border border-accent-dark/30 border-l-4 border-l-accent-dark bg-paper p-4">
                <p className="text-base font-bold">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-accent-dark">Not mentioned</span>
                  Exit sign is dark.
                </p>
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink/70">Example plan, made-up data.</p>
          </div>
        </section>

        <section className="bg-ink text-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-[28px] font-extrabold leading-tight">Your next walkthrough could be a work plan.</h2>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              Grab your phone, walk the space for a minute, and see what SightWork finds.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/start"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Film a walkthrough
              </Link>
              <Link
                href="/start?view=example"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-base font-semibold text-white hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                See an example plan
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-ink/70 sm:px-6">
        Built for the Meta AI Developer Hackathon 2026.
      </footer>
    </>
  );
}
