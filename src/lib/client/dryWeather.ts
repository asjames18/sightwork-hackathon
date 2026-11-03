/**
 * A reminder for steps that happen outside: roofs, gutters, siding, fences, decks, driveways, walkways and exterior paint.
 * It only reads the words the plan wrote on a step, so it is a nudge to pick the day, not a weather forecast.
 */
export const WEATHER_LABEL = "Needs dry weather";
export const WEATHER_HINT =
  "Plan this for a dry day, check the forecast the day before, and have a rain date in mind; wet or windy weather makes outdoor work slower and less safe.";

const OUTDOOR =
  /\b(roof(s|ing|top)?|shingles?|gutters?|downspouts?|soffits?|fascia|siding|fences?|fencing|(back|front|wood|outdoor|exterior|porch|patio|pool|composite) decks?|decking|driveways?|sidewalks?|walkways?|parking lots?|patios?|porch(es)?|yards?|lawns?|playgrounds?|outdoors?|exterior(s)?|outside (of )?the (building|house|church|school|entrance)|curb ramps?|retaining walls?|landscap(e|ing))\b/i;
/** Words where an outdoor place is only mentioned, not where the crew works. */
const NOT_THAT = /\b(indoors?|inside (the )?(building|room)|no (outdoor|exterior|roof|yard) work|not (an )?outdoor|(roof|yard|outdoor|exterior|porch) (is|are) (fine|ok|okay|sound|not (part|included|needed)))\b/i;
/** A step that only walks to or looks at the outside, such as checking where a leak came in. */
const LOOK_ONLY = /^\s*(check|look|inspect|note|photograph|confirm|ask)\b[^.]*\b(roof|gutters?|yard|outside)\b[^.]*\.?\s*$/i;

/** True when the words of a step put the crew outdoors, where rain or wind changes the plan. */
export function needsDryWeather(step: { title?: string; detail?: string }): boolean {
  const title = step.title ?? "";
  const text = `${title}. ${step.detail ?? ""}`;
  if (!text.replace(/[.\s]/g, "")) return false;
  if (NOT_THAT.test(text)) return false;
  if (LOOK_ONLY.test(title) && !(step.detail ?? "").trim()) return false;
  return OUTDOOR.test(text);
}
