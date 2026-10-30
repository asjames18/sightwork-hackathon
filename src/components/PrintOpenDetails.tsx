"use client";

import { useEffect, useRef, type DetailsHTMLAttributes } from "react";

/**
 * A <details> that opens itself for printing (Save PDF) and goes back to how it was afterwards, so a
 * collapsed section still ends up in the saved plan.
 */
export function PrintOpenDetails(props: DetailsHTMLAttributes<HTMLDetailsElement> & { "data-testid"?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let wasOpen = false;
    const before = () => {
      if (!ref.current) return;
      wasOpen = ref.current.open;
      ref.current.open = true;
    };
    const after = () => {
      if (ref.current) ref.current.open = wasOpen;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return <details ref={ref} {...props} />;
}
