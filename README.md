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

## Built during the hackathon
Everything in this repository was written during the event (Oct 26 – Nov 4, 2026). The idea and planning came before; no earlier code is included. Antonio built SightWork with AI coding assistance and deploys it himself.

## Running it
Setup instructions will be added as the build lands. The Meta Model API key is read from an environment variable and is never committed to this repo.

## Status
Work in progress during the hackathon.
