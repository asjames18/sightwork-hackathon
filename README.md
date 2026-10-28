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

The planning steps (4 and 5) run on **Muse Spark Open**, Meta's open-weights model, served on Baseten. SAM 3.1 outlines and the Muse Image "after" picture are optional: when either one is unavailable, the plan still comes back complete, and the screen marks those parts as coming soon.

## Built during the hackathon
Everything in this repository was written during the event (Oct 26 – Nov 4, 2026). The idea and planning came before; no earlier code is included. Antonio built SightWork with AI coding assistance and deploys it himself.

## Running it
You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then add your own keys (see "Real runs"); .env.local is never committed
npm run dev
```
Then open http://localhost:3000.

### Preview with example data (no API calls, no keys)
By default the browser uses a built-in example run, so every screen works without any keys. These links jump straight to a screen:
- `http://localhost:3000/?view=example` opens the example plan.
- `?view=example&mock=nometa` shows a plan made without SAM outlines or an after picture.
- `?view=example&mock=nocost` shows a plan whose cost step failed.
- `?view=last` reopens the last finished plan on this device.

### Real runs
To send a walkthrough to the models, open `http://localhost:3000/?runner=api` (or set `NEXT_PUBLIC_SIGHTWORK_RUNNER=api`) and upload a video. The server reads these keys from the environment only:
- `BASETEN_API_KEY`: Muse Spark Open on Baseten, which writes the plan (the default, `PLAN_PROVIDER=baseten`).
- `META_API_KEY` (or `MODEL_API_KEY`): the Meta Model API for narration transcription, SAM 3.1 outlines and the Muse Image after picture. Set `PLAN_PROVIDER=meta` to run the planning steps on Muse Spark instead.

If SAM 3.1 or Muse Image isn't available to your key, those steps are skipped and the plan still comes back complete. Keys are never logged or committed.

Each plan is one request: still frames from the video (one about every 2 seconds, up to 48, longest side 1024 px) and the narration as 16 kHz mono audio. The full video stays on the device. The browser keeps a request under about 9 MB, since the server accepts up to 10 MB. Some hosts cap request bodies lower (Vercel functions take 4.5 MB), so a long narrated walkthrough can come back as "too large" there.

On the plan screen, "Save PDF" prints a clean copy of the plan.

## Status
Work in progress during the hackathon.
