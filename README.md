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

The planning steps (4 and 5) are moving to **Muse Spark Open**, Meta's open-weights model, served on Baseten. SAM 3.1 outlines and the Muse Image "after" picture are optional: when either one is unavailable, the plan still comes back complete, and the screen marks those parts as coming soon.

## Built during the hackathon
Everything in this repository was written during the event (Oct 26 – Nov 4, 2026). The idea and planning came before; no earlier code is included. Antonio built SightWork with AI coding assistance and deploys it himself.

## Running it
Full setup instructions will be added as the build lands. API keys are read from environment variables and are never committed to this repo.

To preview the screens with example data (no API calls):
```bash
npm install
npm run dev
```
Then open http://localhost:3000 and choose the example plan. Add `?mock=nometa` to the URL to see a plan made without outlines or an after picture, and `?plan=baseten` to label the planning steps as Muse Spark Open.

## Status
Work in progress during the hackathon.
