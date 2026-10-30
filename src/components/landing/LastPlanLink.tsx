"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hasLastPlan } from "@/lib/client/lastPlan";

// The landing is static; this small client piece only shows up when a finished plan is saved
// on this device, so returning users can reopen it without another run. Server render and the
// first client render both show nothing, so there's no hydration mismatch.
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const hasSavedPlan = hasLastPlan;
const noPlanOnServer = () => false;

export function LastPlanLink() {
  const saved = useSyncExternalStore(subscribe, hasSavedPlan, noPlanOnServer);
  if (!saved) return null;
  return (
    <p className="mt-4 text-base">
      <Link
        href="/start?view=last"
        className="-mx-1 inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Open my last plan
      </Link>
    </p>
  );
}
