"use client";

import { useEffect, useState } from "react";
import type { PlanJobStatus, RunStep, StepCheck } from "@/lib/types";
import type { PlanJobRunner } from "./planJob";

export type StepChecks = Partial<Record<RunStep, StepCheck>>;

/** Adds a status line's check (if any) to this run's checks. Pure, so batched updates never drop one. */
export function addCheck(checks: StepChecks, s: PlanJobStatus): StepChecks {
  return s.state === "running" && s.check ? { ...checks, [s.step]: s.check } : checks;
}

/**
 * Starts a plan job whenever `file` or `run` changes and returns its latest status, plus the latest check per
 * step this run. Checks are collected as each line arrives, not read off the latest status, because several
 * lines can land in one render (one network chunk, or a check line followed at once by the next step).
 * Bump `run` to retry the same video. Leaving the screen aborts the job.
 */
export function usePlanJob(runner: PlanJobRunner, file: File | null, run: number): { status: PlanJobStatus | null; checks: StepChecks } {
  const [status, setStatus] = useState<PlanJobStatus | null>(null);
  const [checks, setChecks] = useState<StepChecks>({});

  useEffect(() => {
    setChecks({});
    if (!file) {
      setStatus(null);
      return;
    }
    const controller = new AbortController();
    setStatus({ state: "running", step: "uploading" });
    const onStatus = (s: PlanJobStatus) => {
      if (controller.signal.aborted) return;
      setStatus(s);
      if (s.state === "running" && s.check) setChecks((c) => addCheck(c, s));
    };
    runner({ file, signal: controller.signal, onStatus }).catch(() => {
      if (!controller.signal.aborted)
        setStatus({ state: "failed", step: "uploading", message: "Something went wrong before the plan could start. Try again." });
    });
    return () => controller.abort();
  }, [runner, file, run]);

  return { status, checks };
}
