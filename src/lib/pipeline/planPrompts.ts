/**
 * SightWork pipeline prompts: prompt 03 (reason) and prompt 05 (cost).
 *
 * Templates and schemas copied verbatim from the planning repo on
 * 2026-10-26 (handoff/prompts/03-reason.md, handoff/prompts/05-costRange.md;
 * prompt 03 re-synced 2026-10-27 for rule 7: no total/subtotal inventory rows.
 * Grok Bot owns the prompt wording). When a prompt file changes, re-copy
 * the template and schema here and bump the date above; the route must
 * never run a stale prompt against a new schema, or vice versa.
 *
 * Why this module exists: runReason and estimateCost take a static
 * deps.prompt, but prompts 03 and 05 carry per-request variables
 * (frame list, segmentation JSON, transcript, materials, steps). The
 * builders below fill those variables from the step input, so the
 * /api/plan route can hand each step a finished prompt. The builders
 * are pure: no API calls, no keys, no provider text.
 */

import type { CostInput } from "./cost";
import type { ReasonInput } from "./reason";

/** Prompt 03 template; placeholders are filled by buildReasonPrompt. */
export const REASON_PROMPT_TEMPLATE: string = "You are SightWork. Someone filmed a walkthrough of a {{space_type}} called \"{{space_name}}\" ({{duration_sec}} s) while saying out loud what needs work. You get {{frame_count}} still frames from that video, an object count from a segmentation model, and the narration transcript. Produce a work plan as JSON matching the provided schema exactly. Output JSON only.\n\nFRAMES (images are attached in this order; frameIndex is the position, starting at 0):\n{{frame_list}}\n\nSEGMENTATION (SAM 3.1; counts are the max seen in any single frame, so they are a floor; flaggedFrames had a possible hazard):\n{{segmentation_json}}\n\nTRANSCRIPT (each line starts with [seconds] when the speaker started that sentence):\n{{transcript}}\n\nDo this in order:\n\n1. LOOK. Inspect every frame, and inspect flaggedFrames most carefully, against this hazard checklist (use the key in brackets for \"hazard\"):\n   [egress] exit signage/egress; [trip_cable] trip hazards and loose cables across walkways; [water_stain] water stains or sagging on ceilings/walls; [exposed_wiring] exposed wiring or missing cover plates; [damaged_seating] damaged seating; [fire_extinguisher] fire extinguisher missing/unmounted/blocked; [ada_path] steps without ramp or rail, blocked accessible route; [power_strip] overloaded or daisy-chained power strips.\n   Also note cosmetic and repair needs (paint, scuffs, stains, burned-out lights, missing items).\n\n2. LISTEN. List every need the speaker states in the transcript. Write transcriptSummary: one or two plain sentences on what the speaker asked for (null if \"(no narration)\").\n\n3. COMPARE (said vs. seen). For each issue, set \"status\":\n   - \"mentioned\": the speaker said it and a frame shows it. Set \"mention\" to {\"quote\": their exact words, \"saidAtSec\": the [seconds] of that line}. \"unmentioned\": false.\n   - \"unmentioned\": the speaker never said it and it is clearly visible in a specific frame. \"mention\": null. \"unmentioned\": true. Never mark something unmentioned from a guess.\n   - \"mentioned_not_seen\": the speaker said it but no frame clearly shows it. Fill \"mention\", set \"unmentioned\": false, use the frame closest in time to when it was said, and start \"detail\" with: Mentioned in narration, not clearly visible in the frames.\n   - If the transcript is \"(no narration)\", every issue is \"unmentioned\".\n   \"unmentioned\" must be true exactly when status is \"unmentioned\".\n   Also write saidVsSeen: one row per issue, in rank order, with \"status\", \"said\" ({\"quote\",\"atSec\"} or null for unmentioned), \"seen\" ({\"summary\": what the frame shows, \"frameIndex\"} or null for mentioned_not_seen) and \"issueRank\".\n\n4. FILTER. Give each issue a \"confidence\" from 0 to 1. Drop anything under 0.5. A false \"you didn't mention this\" is worse than missing one, so an unmentioned issue needs at least 0.6.\n\n5. RANK. Order issues by: life-safety and code first (egress, exit signs, trip hazards, exposed wiring, extinguishers), then active damage that gets worse (leaks, water stains), then function (broken seating, dead lights, missing items), then cosmetic. Within a tier, things affecting more people or used every service rank higher. rank starts at 1 and has no gaps. severity: \"high\" for safety/code or active damage, \"medium\" for function, \"low\" for cosmetic. category: \"safety\", \"damage\", \"function\" or \"cosmetic\" to match the tier. Set \"hazard\" only when the issue matches a checklist item.\n\n6. EVIDENCE. Every issue has one primary frameIndex: the frame that best shows it (0 to {{frame_count}} minus 1), and frameTimeSec equal to that frame's t. \"proofFrames\" lists every frame that shows it, starting with the primary one, each with frameIndex, tSec, a short \"caption\" and, when you can place it, a \"box\" [x1, y1, x2, y2] normalized 0-1000. An unmentioned issue needs at least one proof frame that actually shows the problem.\n\n7. INVENTORY. Start from the segmentation counts. You may raise a count when frames clearly show separate areas (for example front rows and back rows never in the same frame); never lower one below the segmentation floor without saying why in the label. Add obvious countable items the segmentation missed (e.g. damaged chairs, choir chairs) only if you can count them in a frame. confidence is 0 to 1: copy the segmentation confidence, or your own estimate for items you added. \"method\": \"sam\" (copied), \"model\" (you counted) or \"sam+model\" (you adjusted a segmentation count). If your count and the segmentation count differ by more than 20%, give \"range\" [low, high] that contains count. \"zone\" names the area when it helps, e.g. \"stage\", \"main floor\". Labels are short and plural, e.g. \"Padded chairs (main floor)\". Each object is counted in exactly one row: never add a total or subtotal row on top of zone rows (no \"Padded chairs (total)\" next to \"Padded chairs (main floor)\").\n\n8. MATERIALS. List what is needed to fix the issues. qty is a string with units, e.g. \"2\", \"1 roll\", \"5 chairs\". \"forIssues\" lists the ranks it fixes; \"note\" adds anything else. Do not include prices.\n\n9. WORK ORDER. Ordered steps that fix every issue, safety first, and in the order the trade work must happen (leak source before ceiling tiles, electrical before paint, cables before flooring). order starts at 1. Use dependsOn (the order number of one earlier step) only when a step truly cannot start before another finishes. \"fixes\" lists the issue ranks the step fixes; every issue rank appears in at least one step. \"trade\" is who does it, e.g. \"volunteer\", \"electrician\", \"painter\". \"hours\" is a [low, high] labor estimate only when you can reason about it from what you see. Keep titles short and imperative; detail says what to do and why.\n\n10. HERO FRAME. Set heroFrameIndex to the widest, sharpest frame that shows the most of the area the work order changes. The \"after\" image is rendered from it.\n\n11. Set spaceName to \"{{space_name}}\" and generatedFrom to: \"Walkthrough video, {{frame_count}} frames, {{duration_sec}} s\" + (\", narrated\" if there is a transcript).\n\nPlain, specific language. No marketing words. Do not invent measurements, brands, or prices.\n";

/** Prompt 03 structured-output schema (has $defs; runReason inlines them). */
export const REASON_SCHEMA: Record<string, unknown> = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "spaceName",
    "generatedFrom",
    "inventory",
    "issues",
    "materials",
    "workOrder",
    "transcriptSummary",
    "saidVsSeen",
    "heroFrameIndex"
  ],
  "$defs": {
    "box": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 0,
        "maximum": 1000
      },
      "minItems": 4,
      "maxItems": 4
    },
    "range": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 0
      },
      "minItems": 2,
      "maxItems": 2
    },
    "status": {
      "type": "string",
      "enum": [
        "mentioned",
        "unmentioned",
        "mentioned_not_seen"
      ]
    }
  },
  "properties": {
    "spaceName": {
      "type": "string"
    },
    "generatedFrom": {
      "type": "string"
    },
    "transcriptSummary": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroFrameIndex": {
      "type": "integer",
      "minimum": 0
    },
    "inventory": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "label",
          "count",
          "confidence"
        ],
        "properties": {
          "label": {
            "type": "string"
          },
          "count": {
            "type": "integer",
            "minimum": 0
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "range": {
            "$ref": "#/$defs/range"
          },
          "method": {
            "type": "string",
            "enum": [
              "sam",
              "model",
              "sam+model"
            ]
          },
          "zone": {
            "type": "string"
          }
        }
      }
    },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rank",
          "title",
          "detail",
          "severity",
          "frameIndex",
          "frameTimeSec",
          "unmentioned",
          "status",
          "mention",
          "proofFrames",
          "confidence",
          "category"
        ],
        "properties": {
          "rank": {
            "type": "integer",
            "minimum": 1
          },
          "title": {
            "type": "string"
          },
          "detail": {
            "type": "string"
          },
          "severity": {
            "type": "string",
            "enum": [
              "high",
              "medium",
              "low"
            ]
          },
          "frameIndex": {
            "type": "integer",
            "minimum": 0
          },
          "frameTimeSec": {
            "type": "number",
            "minimum": 0
          },
          "unmentioned": {
            "type": "boolean"
          },
          "status": {
            "$ref": "#/$defs/status"
          },
          "mention": {
            "anyOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "quote",
                  "saidAtSec"
                ],
                "properties": {
                  "quote": {
                    "type": "string"
                  },
                  "saidAtSec": {
                    "type": "number",
                    "minimum": 0
                  }
                }
              }
            ]
          },
          "proofFrames": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "frameIndex",
                "tSec"
              ],
              "properties": {
                "frameIndex": {
                  "type": "integer",
                  "minimum": 0
                },
                "tSec": {
                  "type": "number",
                  "minimum": 0
                },
                "box": {
                  "$ref": "#/$defs/box"
                },
                "caption": {
                  "type": "string"
                }
              }
            }
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "category": {
            "type": "string",
            "enum": [
              "safety",
              "damage",
              "function",
              "cosmetic"
            ]
          },
          "hazard": {
            "type": "string",
            "enum": [
              "egress",
              "trip_cable",
              "water_stain",
              "exposed_wiring",
              "damaged_seating",
              "fire_extinguisher",
              "ada_path",
              "power_strip"
            ]
          }
        }
      }
    },
    "saidVsSeen": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "said",
          "seen"
        ],
        "properties": {
          "status": {
            "$ref": "#/$defs/status"
          },
          "said": {
            "anyOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "quote",
                  "atSec"
                ],
                "properties": {
                  "quote": {
                    "type": "string"
                  },
                  "atSec": {
                    "type": "number",
                    "minimum": 0
                  }
                }
              }
            ]
          },
          "seen": {
            "anyOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "summary",
                  "frameIndex"
                ],
                "properties": {
                  "summary": {
                    "type": "string"
                  },
                  "frameIndex": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            ]
          },
          "issueRank": {
            "type": "integer",
            "minimum": 1
          }
        }
      }
    },
    "materials": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "item",
          "qty"
        ],
        "properties": {
          "item": {
            "type": "string"
          },
          "qty": {
            "type": "string"
          },
          "note": {
            "type": "string"
          },
          "forIssues": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 1
            }
          }
        }
      }
    },
    "workOrder": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "order",
          "title",
          "detail"
        ],
        "properties": {
          "order": {
            "type": "integer",
            "minimum": 1
          },
          "title": {
            "type": "string"
          },
          "detail": {
            "type": "string"
          },
          "dependsOn": {
            "type": "integer",
            "minimum": 1
          },
          "fixes": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 1
            }
          },
          "trade": {
            "type": "string"
          },
          "hours": {
            "$ref": "#/$defs/range"
          }
        }
      }
    }
  }
};

/** Prompt 05 template; placeholders are filled by buildCostPrompt. */
export const COST_PROMPT_TEMPLATE: string = "You are SightWork's cost estimator. A {{space_type}} needs the repairs below. Give unit prices and a labor rate for {{region}} so code can compute a rough cost range. Output JSON only, matching the schema.\n\nLABOR BASIS: {{labor_basis}} (volunteer = church volunteers do general work for free and only licensed trades are paid; contractor = every step is paid; mixed = paid unless the trade is \"volunteer\").\n\nMATERIALS (index, item, quantity):\n{{materials_list}}\n\nWORK STEPS:\n{{steps_list}}\n\nDo this:\n1. For each material, give unitCost [low, high] in USD for ONE unit of the quantity's unit (one chair, one roll, one gallon), mid-grade, bought retail in or near {{region}}. Use web_search to ground prices at a home-improvement or supply retailer that serves {{region}}. If you can't find a price, give your best range, set \"grounded\": false, and keep the range wide. Never give a single number: low must be less than high unless the price is fixed.\n2. Give laborRate [low, high] USD per hour for the licensed trades in these steps in {{region}}. Use web_search. If the steps need no licensed trade and the basis is volunteer, still give the rate; code decides whether to use it.\n3. Give contingencyPct [low, high] between 10 and 20. Use the higher end when any issue is hidden damage (water, wiring) whose extent the video can't show.\n4. List assumptions in plain words, one per line: the region, mid-grade materials, the labor basis, anything you assumed about sizes or quantities, and which prices are not grounded.\n5. List sources: only pages you actually opened with web_search, each with title and url. Do not invent URLs.\n\nDo not compute a total. Do not quote brand-name products unless the search result was for one. Plain, specific language.\n";

/** Prompt 05 structured-output schema (flat: no $ref, no anyOf). */
export const COST_SCHEMA: Record<string, unknown> = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "unitCosts",
    "laborRate",
    "contingencyPct",
    "assumptions",
    "sources"
  ],
  "properties": {
    "unitCosts": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "materialIndex",
          "unit",
          "unitCost",
          "grounded"
        ],
        "properties": {
          "materialIndex": {
            "type": "integer",
            "minimum": 0
          },
          "unit": {
            "type": "string",
            "description": "What one unit is, e.g. \"chair\", \"roll\", \"gallon\""
          },
          "unitCost": {
            "type": "array",
            "items": {
              "type": "number",
              "minimum": 0
            },
            "minItems": 2,
            "maxItems": 2
          },
          "grounded": {
            "type": "boolean"
          },
          "sourceIndex": {
            "type": "integer",
            "minimum": 0,
            "description": "Index into sources, when grounded"
          }
        }
      }
    },
    "laborRate": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 0
      },
      "minItems": 2,
      "maxItems": 2
    },
    "contingencyPct": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 10,
        "maximum": 20
      },
      "minItems": 2,
      "maxItems": 2
    },
    "assumptions": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "minItems": 1
    },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "title",
          "url"
        ],
        "properties": {
          "title": {
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        }
      }
    }
  }
};

/** Fill one {{name}} placeholder in every occurrence. */
function fill(template: string, name: string, value: string): string {
  return template.split(`{{${name}}}`).join(value);
}

/** True when a template still has an unfilled {{placeholder}}. */
export function hasUnfilledPlaceholders(prompt: string): boolean {
  return /\{\{[a-z_]+\}\}/.test(prompt);
}

/**
 * Build the finished prompt 03 for one reason step. Variable table from
 * prompt 03: space_name falls back to "Walkthrough", space_type to
 * "church sanctuary", transcript to the literal "(no narration)" when
 * null, frame_list one line per frame in array order.
 */
export function buildReasonPrompt(input: ReasonInput): string {
  const spaceName = input.spaceName && input.spaceName.trim() ? input.spaceName : "Walkthrough";
  const spaceType = input.spaceType && input.spaceType.trim() ? input.spaceType : "church sanctuary";
  const frameList = input.frames
    .map((f, i) => `frameIndex=${i} t=${f.tSec}s`)
    .join("\n");
  let prompt = REASON_PROMPT_TEMPLATE;
  prompt = fill(prompt, "space_type", spaceType);
  prompt = fill(prompt, "space_name", spaceName);
  prompt = fill(prompt, "duration_sec", String(input.durationSec));
  prompt = fill(prompt, "frame_count", String(input.frames.length));
  prompt = fill(prompt, "frame_list", frameList);
  // No segmentation (the segment step failed): say so explicitly in
  // the SEGMENTATION section, so the model counts from the frames
  // instead of trusting counts that are not there. The template text
  // itself is Grok Bot's wording and stays untouched; only this
  // placeholder fill changes.
  const segmentationJson = input.segmentation
    ? JSON.stringify(input.segmentation)
    : "(no segmentation data: the segmentation step failed, so there are no SAM counts and no flaggedFrames; count objects yourself from the frames, and use method \"model\" for every inventory item)";
  prompt = fill(prompt, "segmentation_json", segmentationJson);
  prompt = fill(prompt, "transcript", input.transcript ?? "(no narration)");
  return prompt;
}

/**
 * Build the finished prompt 05 for one cost step. Variable table from
 * prompt 05: labor_basis falls back to "volunteer". CostInput carries no
 * spaceType, so the caller passes PlanRequest.spaceType (default
 * "church sanctuary"). Only called with a region: estimateCost returns
 * null without one, so no prompt is built for a region-less request.
 */
export function buildCostPrompt(input: CostInput, spaceType = "church sanctuary"): string {
  const space = spaceType && spaceType.trim() ? spaceType : "church sanctuary";
  const laborBasis = input.laborBasis ?? "volunteer";
  const materialsList = input.materials
    .map((m, i) => `i=${i} item="${m.item}" qty="${m.qty}" note="${m.note ?? ""}"`)
    .join("\n");
  const stepsList = input.workOrder
    .map(
      (s) =>
        `order=${s.order} title="${s.title}" trade="${s.trade ?? "unknown"}" hours=${
          s.hours ? `[${s.hours[0]}, ${s.hours[1]}]` : "unknown"
        }`,
    )
    .join("\n");
  let prompt = COST_PROMPT_TEMPLATE;
  prompt = fill(prompt, "space_type", space);
  prompt = fill(prompt, "region", input.region ?? "");
  prompt = fill(prompt, "labor_basis", laborBasis);
  prompt = fill(prompt, "materials_list", materialsList);
  prompt = fill(prompt, "steps_list", stepsList);
  return prompt;
}

