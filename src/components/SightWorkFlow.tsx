"use client";

import { useEffect, useState } from "react";
import { PLAN_STEPS, type WorkPlan } from "@/lib/types";
import { samplePlan } from "@/lib/mock/samplePlan";
import { mockPlanJob } from "@/lib/client/planJob";
import { usePlanJob } from "@/lib/client/usePlanJob";
import { UploadStep } from "./UploadStep";
import { ProcessingStep } from "./ProcessingStep";
import { PlanView } from "./PlanView";

type Stage =
  | { kind: "upload" }
  | { kind: "processing"; file: File; run: number }
  | { kind: "plan"; plan: WorkPlan; videoName: string | null };

/** Swap point: the real API runner replaces the mock here once the api route lands. */
const runPlanJob = mockPlanJob;

export function SightWorkFlow() {
  const [stage, setStage] = useState<Stage>({ kind: "upload" });
  const job = usePlanJob(runPlanJob, stage.kind === "processing" ? stage.file : null, stage.kind === "processing" ? stage.run : 0);

  useEffect(() => {
    if (stage.kind === "processing" && job?.state === "done") {
      setStage({ kind: "plan", plan: job.plan, videoName: stage.file.name });
    }
  }, [job, stage]);

  const showExample = () => setStage({ kind: "plan", plan: samplePlan, videoName: null });
  const current = job && job.state !== "done" ? PLAN_STEPS.indexOf(job.step) : 0;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <button type="button" onClick={() => setStage({ kind: "upload" })} className="text-xl font-extrabold tracking-tight">
          Sight<span className="text-accent">Work</span>
        </button>
        {stage.kind === "plan" && (
          <button type="button" onClick={() => setStage({ kind: "upload" })} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm font-medium">
            New walkthrough
          </button>
        )}
      </header>

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
        />
      )}
      {stage.kind === "plan" && <PlanView plan={stage.plan} videoName={stage.videoName} />}
    </main>
  );
}
