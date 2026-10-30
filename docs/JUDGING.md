# How SightWork maps to the judging criteria

Criteria and weights from the Official Rules embedded on the [Cerebral Valley event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon): **Impact 30%** (real-world potential and fit), **Demo 25%** (works, holds up live, quality of the demo video), **Use of Meta AI tooling 25%** (creative, beyond a basic integration), **Technical depth 20%**. SightWork is on the **Startup track**, "judged on technical execution and whether it holds up in production", under the theme **Build for Your World**.

## Impact (30%)
- Who it helps: churches, schools and nonprofits that run on volunteers and have no facilities staff, plus small contractors scoping a job.
- What changes: a one-minute phone walkthrough becomes a volunteer-ready plan in about 2 to 3 minutes, for under $1 in model calls on real runs: problems worst first with proof frames, who does each step, a shopping list, and a rough local cost.
- It travels: Send to your team (share sheet or clipboard), Save PDF, ticks saved per plan for work day.

## Demo (25%)
- Live site with a real run on the landing page (a church sanctuary stage, nothing edited but a covered logo) and four labeled samples.
- Processing screen names the Meta model behind each step with a running clock.
- `/status` shows the live build and config at a glance, with no model calls.

## Use of Meta AI tooling (25%)
- Four Meta models chained in one agent run, one job each: Muse Voice Transcribe, SAM 3.1, Muse Spark Open (Meta open weights on Baseten, the default plan engine) and Muse Image; Muse Spark with web search prices the work.
- The same open-weights model runs a separate review-only pass that checks every problem against its photo.
- Every plan ends with a Powered by Meta AI panel that says which model did each step and whether it ran.

## Technical depth (20%)
- Device-side frame selection (sharpest neighbour per tick), narration extraction and leveling, request-size budgeting.
- Schema-validated model outputs, per-step checks streamed to the screen, spend cap in code, retries and graceful skips.
- Offline eval harness (`npm run eval`) with a baseline held in `npm test`; Playwright e2e with axe at phone and desktop widths. See [ARCHITECTURE.md](ARCHITECTURE.md).
