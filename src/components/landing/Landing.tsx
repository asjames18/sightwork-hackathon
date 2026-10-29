import Link from "next/link";

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary = `inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent-dark px-6 py-3 text-base font-semibold text-white hover:bg-ink ${ring}`;
const secondary = `inline-flex min-h-[44px] items-center justify-center rounded-xl border border-ink/20 bg-white/60 px-6 py-3 text-base font-semibold text-ink hover:border-ink/40 ${ring}`;

/**
 * Landing page at /. Static server component, no client JS.
 * Copy is word for word from the agreed Conclusion in the design handoff. This first step
 * ships header, hero, closing CTA and footer; the middle sections follow in later commits.
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
