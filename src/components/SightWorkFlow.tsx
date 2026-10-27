"use client";

import { useEffect, useRef, useState } from "react";
import { PLAN_STEPS, type PlanStep, type WorkPlan } from "@/lib/types";
import { pickMockPlan } from "@/lib/mock/pickMockPlan";
import { selectedPlanJob } from "@/lib/client/selectRunner";
import { usePlanJob } from "@/lib/client/usePlanJob";
import { loadLastPlan, saveLastPlan } from "@/lib/client/lastPlan";
import { UploadStep } from "./UploadStep";
import { ProcessingStep } from "./ProcessingStep";
import { PlanView } from "./PlanView";

type Stage =
  | { kind: "upload" }
  | { kind: "processing"; file: File; run: number }
  | { kind: "plan"; plan: WorkPlan; videoName: string | null };

/** Mock by default; NEXT_PUBLIC_SIGHTWORK_RUNNER=api or `?runner=api` switches to POST /api/plan. */
const runPlanJob = selectedPlanJob;

export function SightWorkFlow() {
  const [stage, setStage] = useState<Stage>({ kind: "upload" });
  const job = usePlanJob(runPlanJob, stage.kind === "processing" ? stage.file : null, stage.kind === "processing" ? stage.run : 0);

  useEffect(() => {
    if (stage.kind === "processing" && job?.state === "done") {
      setStage({ kind: "plan", plan: job.plan, videoName: stage.file.name });
      saveLastPlan(job.plan, stage.file.name);
    }
  }, [job, stage]);

  const showExample = () => setStage({ kind: "plan", plan: pickMockPlan(), videoName: null });

  // `?view=example` opens straight on the example plan: a direct link for screen checks at
  // phone, tablet and desktop widths, and a one-tap fallback during the demo.
  // `?view=last` reopens the last finished plan on this device (falls back to the upload screen).
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "example") showExample();
    if (view === "last") {
      const saved = loadLastPlan();
      if (saved) setStage({ kind: "plan", plan: saved.plan, videoName: saved.videoName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = job && job.state !== "done" ? PLAN_STEPS.indexOf(job.step) : 0;

  // Steps the server reported as skipped this run. The list is cumulative, so keep the latest one
  // through a failure (failed lines don't carry it); a new run starts empty.
  const [skipped, setSkipped] = useState<PlanStep[]>([]);
  const runKey = stage.kind === "processing" ? stage.run : 0;
  useEffect(() => setSkipped([]), [runKey]);
  useEffect(() => {
    if (job?.state === "running" && job.skipped?.length) setSkipped(job.skipped);
  }, [job]);

  // New stage: back to the top so the next screen starts at its heading, not mid-scroll.
  const firstStage = useRef(true);
  useEffect(() => {
    if (firstStage.current) {
      firstStage.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [stage.kind]);

  // Phones get the full width; tablets and desktops get a readable column, wider for the plan.
  const width = stage.kind === "plan" ? "max-w-xl md:max-w-2xl lg:max-w-3xl" : "max-w-xl md:max-w-2xl";
  const startOver = () => setStage({ kind: "upload" });

  return (
    <>
      <header className="sticky top-0 z-20 print:hidden border-b border-ink/10 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className={`mx-auto flex min-h-14 w-full items-center justify-between gap-3 px-4 sm:px-6 ${width}`}>
          <button
            type="button"
            onClick={startOver}
            aria-label="SightWork, start a new walkthrough"
            className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-xl font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span>
              Sight<span className="text-accent">Work</span>
            </span>
            <span className="hidden text-sm font-medium tracking-normal text-ink/50 md:inline">Film a walkthrough. Get a work plan.</span>
          </button>
          {stage.kind === "plan" && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Save this plan as a PDF or print it"
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
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 ${width}`}>
      {stage.kind === "upload" && (
        <UploadStep onVideo={(file) => setStage({ kind: "processing", file, run: 1 })} onExample={showExample} />
      )}
      {stage.kind === "processing" && (
        <ProcessingStep
          steps={PLAN_STEPS}
          current={current}
          videoName={stage.file.name}
          failure={job?.state === "failed" ? { message: job.message } : null}
          onRetry={() => setStage({ kind: "processing", file: stage.file, run: stage.run + 1 })}
          onExample={showExample}
          skipped={skipped}
        />
      )}
      {stage.kind === "plan" && <PlanView plan={stage.plan} videoName={stage.videoName} />}
      </main>
    </>
  );
}
