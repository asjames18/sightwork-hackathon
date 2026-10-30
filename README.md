# SightWork

**Built by Antonio James** for the Meta AI Developer Hackathon (Oct 26 – Nov 4, 2026), Startup track.

SightWork turns a 60–90 second phone walkthrough of a property into a work plan you can act on.

## What it does
You film one walkthrough. SightWork returns:
- **Counts:** an inventory of what's in the space.
- **Ranked problems:** what needs attention, worst first, including issues the person filming never mentioned.
- **Proof frames:** the video frame behind each finding.
- **Materials:** what the work will need.
- **Order of work:** the steps, in the order they should happen.
- **Cost range:** a rough estimate of what the work will cost.
- **After image:** an AI-generated picture of the finished space.

## How it works
SightWork is a multi-step agent built on Meta's Muse models through the Meta Model API:
1. It samples the key frames from the walkthrough.
2. **Muse Voice Transcribe** turns the narration into text, so SightWork knows what the person said.
3. **SAM 3.1** finds and counts the items.
4. **Muse Spark** compares what was said with what the video shows, ranks the problems (including ones nobody mentioned) and picks a proof frame for each.
5. **Muse Spark** turns the findings into materials, an ordered work plan and a rough cost range.
6. **Muse Image** generates the "after" image.

The planning steps (4 and 5) run on **Muse Spark Open**, Meta's open-weights model, served on Baseten. SAM 3.1 outlines and the Muse Image "after" picture are optional: when either one is unavailable, the plan still comes back complete, and the "How this plan was made" section at the bottom of the plan marks those steps "Off this run." A full run with every step takes a few minutes.

## Built during the hackathon
Everything in this repository was written during the event (Oct 26 – Nov 4, 2026). The idea and planning came before; no earlier code is included. Antonio built SightWork with AI coding assistance and deploys it himself.

## Running it
You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then add your own keys (see "Real runs"); .env.local is never committed
npm run dev
```
Then open http://localhost:3000 for the landing page, or http://localhost:3000/start to go straight to the app.
To check the TypeScript types without starting the app, run `npm run typecheck`.

To run the local checks, run `npm test` (Node 22.18 or newer, no extra packages). They cover the example plans (every image exists at the size the page reserves, every reference points at a real frame or problem, samples are labeled and credited), the upload screen's length check, the API runner's stream handling against a fake server, and the tester-code gate. Nothing in them calls a model or the network.

To run the browser checks, run `npm run e2e` (Playwright; run `npx playwright install chromium` once, or set `E2E_CHROME_PATH` to an installed Chrome). It builds the app, starts it locally with the example runner and every model key blanked, and walks landing → /start → example plan → upload a small test video → processing → plan, plus the 5-second minimum, the tester-code gate (in the browser and on the server), plan-screen keyboard use (section chips, before/after slider keys), Save PDF and the print view, Open my last plan, the 404 page and /credits, the in-page recorder on Chromium's fake camera (a 1080p take at the 8 Mbps setting, cancel and blocked-camera fallbacks, WebM length), at 390 px and 1440 px with an axe accessibility scan on each screen. Every browser request to `/api` is blocked and fails the test, so it never calls a model. Set `E2E_SKIP_BUILD=1` to reuse the last build, or `E2E_BASE_URL` to test a server that's already running. It isn't part of `npm run build` or `npm test`.

### Preview with example data (no API calls, no keys)
By default the browser uses a built-in example run, so every screen works without any keys. These links jump straight to a screen (older `/?view=` style links still work and redirect to `/start` with the query kept):
- `http://localhost:3000/start?view=example` opens the example plan.
- `?view=example&mock=nometa` shows a plan made without SAM outlines or an after picture.
- `?view=example&mock=nocost` shows a plan whose cost step failed.
- `?view=last` reopens the last finished plan on this device.
- `?mock=nometa` (without `view`), then upload any video: the processing screen runs with SAM and the after picture turned off. Looking and Counting flip to "skipped this run" once Comparing starts, the same timing as a real run with no Meta access.
- `?fail=<step>` (for example `?fail=planning`), then upload any video: the preview stops at that step with a failure message, so the error screen can be checked. Nothing is sent anywhere.

### Real runs
To send a walkthrough to the models, open `http://localhost:3000/start?runner=api` (or set `NEXT_PUBLIC_SIGHTWORK_RUNNER=api`) and upload a video. The server reads these keys from the environment only:
- `BASETEN_API_KEY`: Muse Spark Open on Baseten, which writes the plan (the default, `PLAN_PROVIDER=baseten`).
- `META_API_KEY` (or `MODEL_API_KEY`): the Meta Model API for narration transcription, SAM 3.1 outlines and the Muse Image after picture. Set `PLAN_PROVIDER=meta` to run the planning steps on Muse Spark instead.

If SAM 3.1 or Muse Image isn't available to your key, those steps are skipped and the plan still comes back complete. Keys are never logged or committed.

Each run is capped at $10 of model spend, enforced in code. If a call would push a run past the cap, the run stops with a failure message instead of moving on to the next step, and the calls it did make are logged on the server.

On /start, **Record a walkthrough** opens the camera in the page (back camera, asks for 1920×1080 at 30 fps with sound, records at about 8 Mbps, shows the size it actually got, stops itself at 2:30). If the browser can't open the camera it falls back to the phone's camera app; **Choose a video** picks a file you already have. A Camera-app recording is usually still the sharpest.

Each plan is one request: still frames from the video (one about every 2 seconds, up to 48, longest side 1024 px) and the narration as 16 kHz mono audio. The full video stays on the device. The browser keeps a request under about 9 MB, since the server accepts up to 10 MB. Some hosts cap request bodies lower (Vercel functions take 4.5 MB), so a long narrated walkthrough can come back as "too large" there.

On the plan screen, "Save PDF" prints a clean copy of the plan.

## Status
Every step runs end to end on a real walkthrough: frames and narration in, a full plan with SAM counts and an after picture out. Polish continues through the end of the hackathon.
