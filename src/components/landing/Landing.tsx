import Image from "next/image";
import Link from "next/link";
import { LastPlanLink } from "./LastPlanLink";

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
    body: "Usually in a few minutes: problems ranked worst first, each with a proof frame from your video, then the steps in the right order and the materials.",
  },
];

/** Said-vs-saw strip from the featured SAMPLE plan (src/lib/examples/kitchen.ts): CC0 photos, hand-written plan. */
const matched = [
  { said: "Ceiling's opened up here, we'll need new drywall over all of this.", saw: "Loose plaster and lath hanging overhead" },
  { said: "The fireplace front is cracked, I want that fixed.", saw: "Facade split at the top corner" },
];

/**
 * "What you get". The cost line and the after-picture tile are left out on purpose: the agreed copy
 * shows them only if the cost step and Muse Image actually run at submission.
 */
const gets = [
  { title: "Problems, worst first.", body: "Safety items rise to the top, each with the frame and second where it shows." },
  { title: "What you said vs. what we saw.", body: "Every request matched to the video, plus anything you missed." },
  { title: "Counts.", body: "Fixtures, furniture, equipment and more, counted from the video as an approximate range." },
  { title: "Work steps in order.", body: "Fix the leak before the ceiling tile. Who does it, about how long, and what it fixes." },
  { title: "Materials.", body: "A shopping list for the work." },
];

const audiences = [
  { title: "Facilities and property teams.", body: "A consistent first look at any room, with photos attached." },
  { title: "Small contractors and handypeople.", body: "Scope a job from a walkthrough before you price it." },
  { title: "Schools and campuses.", body: "Classrooms, gyms and auditoriums checked before the next term." },
  { title: "Churches and nonprofits.", body: "Turn a walkthrough into a volunteer work-day list." },
];

/** Fine print. Cost and after-picture lines join only if those steps run at submission. */
const finePrint = [
  "Counts are approximate, from what the camera saw.",
  "Your video's frames and narration are sent to the AI providers to build your plan, and we don't keep a copy on our servers. The finished plan is saved on your device.",
];

const secondary = `inline-flex min-h-[44px] items-center justify-center rounded-xl border border-ink/20 bg-white/60 px-6 py-3 text-base font-semibold text-ink hover:border-ink/40 ${ring}`;

/**
 * Landing page at /. Static server component, no client JS.
 * Copy is word for word from the agreed Conclusion in the design handoff: header, hero, how it works,
 * the said-vs-saw band, what you get, who it's for, built on Meta's open models, fine print,
 * closing CTA and footer.
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
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          <div>
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
          <LastPlanLink />
          <p className="mt-4 text-sm text-ink/70">Free to try in this demo. No account needed.</p>
          </div>
          <HeroPhone />
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
              You mention three things. SightWork finds three more.
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
                  Shutoff valve under the sink is leaking.
                </p>
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink/70">Sample plan on free-to-use (CC0) photos of a real kitchen renovation. The narration and plan are written by hand to show the format.</p>
          </div>
        </section>

        <section aria-labelledby="get-heading" className="border-t border-ink/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="get-heading" className="text-[28px] font-extrabold leading-tight">What you get</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gets.map((item) => (
                <li key={item.title} className="rounded-2xl border border-ink/10 bg-white p-5">
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-ink/75">{item.body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base text-ink/75">Plus: save the whole plan as a PDF to share with your team.</p>
          </div>
        </section>

        <section aria-labelledby="who-heading" className="border-t border-ink/10 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="who-heading" className="text-[28px] font-extrabold leading-tight">Who it&apos;s for</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {audiences.map((item) => (
                <li key={item.title} className="rounded-2xl border border-ink/10 bg-paper p-5">
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-ink/75">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="meta-heading" className="border-t border-ink/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="meta-heading" className="text-[28px] font-extrabold leading-tight">Built on Meta&apos;s open models</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/75">
              SightWork plans the work with Muse Spark Open, Meta&apos;s open-weights model, running on Baseten, and reads your
              narration with Muse Voice Transcribe.
            </p>
            <p className="mt-3 text-sm text-ink/70">Built for the Meta AI Developer Hackathon 2026.</p>
          </div>
        </section>

        <section aria-labelledby="fine-heading" className="border-t border-ink/10 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <h2 id="fine-heading" className="text-[28px] font-extrabold leading-tight">The honest fine print</h2>
            <ul className="mt-6 grid max-w-2xl list-disc gap-3 pl-5 text-base leading-relaxed text-ink/75 marker:text-ink/50">
              {finePrint.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
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

/**
 * Hero visual: a phone frame showing the top of the real plan screen, rendered from the featured SAMPLE plan
 * (kitchen renovation on CC0 photos; public/landing/sample-plan.webp, 600x1408). Labeled "Sample" with a solid chip that stays
 * legible at 375 px. Decorative copy of on-page content, so the image alt describes it briefly.
 * Swap in a before/after crop once the after image runs at submission.
 */
function HeroPhone() {
  return (
    <figure className="relative mx-auto w-full max-w-[260px] sm:max-w-[280px] lg:max-w-[300px]">
      <div className="rounded-[2.5rem] bg-ink p-2.5 shadow-2xl shadow-ink/25">
        <div className="relative aspect-[9/17] overflow-hidden rounded-[2rem] bg-white">
          <Image
            src="/landing/sample-plan.webp"
            alt="SightWork plan screen for a sample kitchen renovation: 6 problems, 3 you didn't mention, 8 work steps, then a frame from the walkthrough."
            width={600}
            height={1408}
            sizes="(min-width: 1024px) 280px, 260px"
            priority
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
      <figcaption className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-white shadow">
        Sample
      </figcaption>
    </figure>
  );
}
