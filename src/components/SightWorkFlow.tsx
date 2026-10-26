"use client";

import { useEffect, useState } from "react";
import type { PlanStep, WorkPlan } from "@/lib/types";
import { samplePlan } from "@/lib/mock/samplePlan";
import { UploadStep } from "./UploadStep";
import { ProcessingStep } from "./ProcessingStep";
import { PlanView } from "./PlanView";

type Stage = { kind: "upload" } | { kind: "processing"; videoName: string } | { kind: "plan"; plan: WorkPlan; videoName: string | null };

/** Mock timings for the step labels. Replaced by real job status later. */
const MOCK_STEPS: PlanStep[] = ["uploading", "listening", "looking", "counting", "comparing", "planning", "picturing"];
const STEP_MS = 650;

export function SightWorkFlow() {
  const [stage, setStage] = useState<Stage>({ kind: "upload" });
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stage.kind !== "processing") return;
    setStepIndex(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= MOCK_STEPS.length) {
        clearInterval(id);
        // No API call yet: every upload shows the EXAMPLE plan.
        setStage({ kind: "plan", plan: samplePlan, videoName: stage.videoName });
      } else {
        setStepIndex(i);
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [stage]);

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
        <UploadStep
          onVideo={(file) => setStage({ kind: "processing", videoName: file.name })}
          onExample={() => setStage({ kind: "plan", plan: samplePlan, videoName: null })}
        />
      )}
      {stage.kind === "processing" && <ProcessingStep steps={MOCK_STEPS} current={stepIndex} videoName={stage.videoName} />}
      {stage.kind === "plan" && <PlanView plan={stage.plan} videoName={stage.videoName} />}
    </main>
  );
}
