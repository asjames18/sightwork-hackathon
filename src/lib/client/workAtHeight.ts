/**
 * A reminder for steps that put a person up high: ladders, scaffolds, lifts, roofs, gutters and ceilings.
 * It only reads the words the plan wrote on a step, so it is a nudge to plan the access and a second
 * person, not a fall-protection procedure.
 */
export const HEIGHT_LABEL = "Working up high";
export const HEIGHT_HINT =
  "Use a ladder, scaffold or lift that fits the job, have a second person steady it, and keep the floor below clear while someone is up there.";

const HIGH_PLACE = /\b(ladders?|scaffold(s|ing)?|(man|scissor|boom|aerial) ?lifts?|roof(s|ing|top)?|gutters?|soffits?|fascia|rafters?|joists?|trusses|truss|clerestory|steeple|catwalk|high windows?|light fixtures?|stage lights?|lighting rig)\b/i;
/** A ceiling is only high work when the step does something to it, not when it is just where a pipe runs. */
const CEILING_WORK = /\b(hang(ing)?|install(ing)?|paint(ing)?|patch(ing)?|repair(ing)?|rebuild(ing)?|replac(e|ing)|fix(ing)?|tap(e|ing)|mud(ding)?|finish(ing)?|texture|skim|pull(ing)? down|tear(ing)? out|remov(e|ing)|reinstall(ing)?)\b[^.]{0,40}\bceilings?\b|\bceiling (fixtures?|lights?|grid|tiles?|panels?|fans?)\b/i;
/** Words where the high place is not a place someone climbs to. */
const NOT_THAT = /\b(lay(ing)? (the |them |all )?(scaffold )?(frames? )?(down|flat)|ceiling (fans? )?(is|are) (fine|ok|okay|sound)|no (ceiling|roof) (work|damage)|(ladders?|ceiling) (is|are) (not|n't) (needed|used))\b/i;

/** True when the words of a step put someone on a ladder, scaffold, lift, roof or at a ceiling. */
export function worksUpHigh(step: { title?: string; detail?: string }): boolean {
  const text = `${step.title ?? ""}. ${step.detail ?? ""}`;
  if (!text.trim() || NOT_THAT.test(text)) return false;
  return HIGH_PLACE.test(text) || CEILING_WORK.test(text);
}
