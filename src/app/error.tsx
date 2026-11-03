"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

/** Catches a failure inside any page and keeps the site's header and skip link around a plain message. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel onRetry={reset} />;
}
