"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RUN_STEPS, type PlanStep, type WorkPlan } from "@/lib/types";
import { EXAMPLES, findExample, type Example } from "@/lib/examples";
import { planJobFor, type RunnerKind } from "@/lib/client/selectRunner";
import { isTesterCodeFailure } from "@/lib/client/apiPlanJob";
import { usePlanJob } from "@/lib/client/usePlanJob";
import { loadLastPlanAsync, saveLastPlan } from "@/lib/client/lastPlan";
import { UploadStep } from "./UploadStep";
import { ProcessingStep } from "./ProcessingStep";
import { PlanView } from "./PlanView";

type Stage =
  // `resume`: back from a run the server refused for a missing or wrong tester code; the same video is
  // shown again with the code prompt open.
  | { kind: "upload"; resume?: File }
  | { kind: "processing"; file: File; run: number; runner: RunnerKind }
  | { kind: "plan"; plan: WorkPlan; videoName: string | null; example?: Example };

/** Nothing runs while there's no video; the runner is chosen per run (see UploadStep and ownVideoRunnerKind). */
const idleJob = planJobFor("mock");

/** `initialExampleId`: open on that example plan (prerendered example pages), instead of the upload screen. */
export function SightWorkFlow({ initialExampleId }: { initialExampleId?: string } = {}) {
  const [stage, setStage] = useState<Stage>(() => {
    if (!initialExampleId) return { kind: "upload" };
    const example = findExample(initialExampleId);
    return { kind: "plan", plan: example.plan, videoName: null, example };
  });
  const { status: job, checks } = usePlanJob(stage.kind === "processing" ? planJobFor(stage.runner) : idleJob, stage.kind === "processing" ? stage.file : null, stage.kind === "processing" ? stage.run : 0);

  useEffect(() => {
    if (stage.kind === "processing" && job?.state === "done") {
      // The preview (mock) runner ends on an example plan: keep its Real run / Sample label.
      setStage({ kind: "plan", plan: job.plan, videoName: stage.file.name, example: EXAMPLES.find((e) => e.plan === job.plan) });
      saveLastPlan(job.plan, stage.file.name);
    }
  }, [job, stage]);

  const showExample = (id?: string) => {
    const example = findExample(id);
    setStage({ kind: "plan", plan: example.plan, videoName: null, example });
  };
  // Falls back to staying on upload if the saved plan was cleared since the link showed.
  // A big real run is kept in IndexedDB, so this can take a moment.
  const showLastPlan = () => {
    void loadLastPlanAsync().then((saved) => {
      if (saved) setStage({ kind: "plan", plan: saved.plan, videoName: saved.videoName });
    });
  };

  // `?view=example` opens straight on the example plan: a direct link for screen checks at
  // phone, tablet and desktop widths, and a one-tap fallback during the demo. On the server it's rewritten
  // to the prerendered /start/example/<id> page (initialExampleId); this client path is the fallback.
  // `?view=last` reopens the last finished plan on this device (falls back to the upload screen).
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    // Prerendered example pages already start on the plan.
    if (view === "example" && !initialExampleId) showExample(new URLSearchParams(window.location.search).get("ex") ?? undefined);
    if (view === "last") {
      void loadLastPlanAsync().then((saved) => {
        if (saved) setStage({ kind: "plan", plan: saved.plan, videoName: saved.videoName });
        else document.documentElement.classList.remove("sw-opening");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The `?view=last` plan is on screen: show the app (app/start/page.tsx hid it to avoid an upload-screen flash).
  useEffect(() => {
    if (stage.kind === "plan") document.documentElement.classList.remove("sw-opening");
  }, [stage.kind]);
  // When the job finishes, show every step passed (not step 1) for the frame before the plan opens,
  // so the bar never snaps back to the start.
  const current = !job ? 0 : job.state === "done" ? RUN_STEPS.length : RUN_STEPS.indexOf(job.step);

  // Steps the server reported as skipped this run. The list is cumulative, so keep the latest one
  // through a failure (failed lines don't carry it); a new run starts empty.
  const [skipped, setSkipped] = useState<PlanStep[]>([]);
  const runKey = stage.kind === "processing" ? stage.run : 0;
  useEffect(() => setSkipped([]), [runKey]);
  useEffect(() => {
    if (job?.state === "running" && job.skipped?.length) setSkipped(job.skipped);
  }, [job]);

  // New stage: back to the top so the next screen starts at its heading, not mid-scroll, and move
  // keyboard and screen-reader focus to that heading (the button that was pressed is gone). "Try again"
  // keeps the processing stage but starts a new run, and its button unmounts too, so do the same then.
  // Compare against the last stage seen rather than a "first run" flag: React's dev Strict Mode runs
  // effects twice on mount, which used to focus (and ring) the upload heading on a fresh page load.
  const shownStage = useRef(`${stage.kind}:${runKey}`);
  useEffect(() => {
    const key = `${stage.kind}:${runKey}`;
    if (shownStage.current === key) return;
    shownStage.current = key;
    window.scrollTo({ top: 0 });
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [stage.kind, runKey]);

  // Phones get the full width; tablets and desktops get a readable column, wider for the plan.
  const width =
    stage.kind === "plan"
      ? "max-w-xl md:max-w-2xl lg:max-w-3xl"
      : stage.kind === "processing"
        ? "max-w-xl md:max-w-2xl lg:max-w-4xl"
        : "max-w-xl md:max-w-2xl";
  const startOver = () => setStage({ kind: "upload" });

  return (
    <>
      {/* Opaque on purpose: a see-through header over the dark before/after picture dropped the orange "Work" below 3:1 (axe). */}
      <header className="sticky top-0 z-20 print:hidden border-b border-ink/10 bg-paper pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1 sm:px-6 ${width}`}>
          {/* The tagline sits beside the button, not in it, so the button's spoken name starts with the
              word you see ("SightWork"), as voice-control users expect. */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={startOver}
              aria-label="SightWork, start a new walkthrough"
              className="-mx-2 flex min-h-11 items-center rounded-lg px-2 text-xl font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sight<span className="text-accent">Work</span>
            </button>
            {/* The upload screen's H1 already says this, and on the plan the header is full with Save PDF and
                New walkthrough, so the tagline only shows while processing (from lg, on one line). */}
            {stage.kind === "processing" && (
              <span className="hidden whitespace-nowrap text-sm font-medium tracking-normal text-ink/65 lg:inline">Film a walkthrough. Get a work plan.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Back to the landing's explainer. On phones the plan header already holds Save PDF and New, so it waits for sm there. */}
            <Link
              href="/#how-heading"
              className={`${stage.kind === "plan" ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center rounded-lg px-2 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
            >
              How it works
            </Link>
            {stage.kind === "plan" && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Save PDF or print this plan"
                  className="min-h-11 shrink-0 rounded-full border border-ink/20 bg-white/60 px-4 text-sm font-medium hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Save PDF
                </button>
                <button
                  type="button"
                  onClick={startOver}
                  className="min-h-11 shrink-0 rounded-full border border-ink/20 bg-white/60 px-4 text-sm font-medium hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="sm:hidden">New</span>
                  <span className="hidden sm:inline">New walkthrough</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 ${width}`}>
      {stage.kind === "upload" && (
        <UploadStep
          onVideo={(file, runner) => setStage({ kind: "processing", file, run: 1, runner })}
          resumeFile={stage.resume}
          onExample={showExample}
          onLastPlan={showLastPlan}
        />
      )}
      {stage.kind === "processing" && (
        <ProcessingStep
          steps={RUN_STEPS}
          current={current}
          videoName={stage.file.name}
          videoFile={stage.file}
          failure={job?.state === "failed" ? { message: job.message } : null}
          onRetry={() => setStage({ ...stage, run: stage.run + 1 })}
          onEnterCode={
            stage.runner === "api" && job?.state === "failed" && isTesterCodeFailure(job.message)
              ? () => setStage({ kind: "upload", resume: stage.file })
              : undefined
          }
          onExample={() => showExample()}
          skipped={skipped}
          checks={checks}
        />
      )}
      {stage.kind === "plan" && <PlanView plan={stage.plan} videoName={stage.videoName} example={stage.example} onMakeYourOwn={startOver} />}
      </main>
    </>
  );
}
