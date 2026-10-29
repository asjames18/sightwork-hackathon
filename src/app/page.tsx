import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

const description =
  "Film a 60 to 90 second walkthrough on your phone. SightWork counts what's there, roughly, finds what needs fixing, including the problems you didn't mention, and lays out the work in order, with proof from your own video.";

export const metadata: Metadata = {
  title: "SightWork: film a walkthrough, get a work plan",
  description,
};

/** Landing. Old app links (/?view=, /?mock=, /?runner=, /?fail=) redirect to /start in next.config.ts. */
export default function Home() {
  return <Landing />;
}
