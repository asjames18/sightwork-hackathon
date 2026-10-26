"use client";

import { useEffect, useState } from "react";
import type { PlanJobStatus } from "@/lib/types";
import type { PlanJobRunner } from "./planJob";

/**
 * Starts a plan job whenever `file` or `run` changes and returns its latest status.
 * Bump `run` to retry the same video. Leaving the screen aborts the job.
 */
export function usePlanJob(runner: PlanJobRunner, file: File | null, run: number): PlanJobStatus | null {
  const [status, setStatus] = useState<PlanJobStatus | null>(null);

  useEffect(() => {
    if (!file) {
      setStatus(null);
      return;
    }
    const controller = new AbortController();
    setStatus({ state: "running", step: "uploading" });
    runner({ file, signal: controller.signal, onStatus: (s) => !controller.signal.aborted && setStatus(s) }).catch(() => {
      if (!controller.signal.aborted)
        setStatus({ state: "failed", step: "uploading", message: "Something went wrong before the plan could start. Try again." });
    });
    return () => controller.abort();
  }, [runner, file, run]);

  return status;
}
