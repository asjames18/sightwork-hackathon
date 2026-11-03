"use client";

import "./globals.css";
import { ErrorPanel } from "@/components/ErrorPanel";

/** Last resort when the root layout itself fails: same message, and Try again reloads the page. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <ErrorPanel onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
