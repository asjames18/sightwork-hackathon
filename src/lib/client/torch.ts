// Phone flashlight ("torch") on the in-page camera. Only some phones expose it, through the video
// track's capabilities; everywhere else the recorder simply shows no light button.

/** The bits of a video track this file uses, so tests can pass a plain object. */
export interface TorchTrack {
  readyState?: string;
  getCapabilities?: () => unknown;
  applyConstraints?: (c: MediaTrackConstraints) => Promise<void>;
}

/** True when the live video track says it can turn the phone's light on. */
export function torchSupported(track: TorchTrack | null | undefined): boolean {
  if (!track || track.readyState === "ended") return false;
  if (typeof track.getCapabilities !== "function" || typeof track.applyConstraints !== "function") return false;
  try {
    const caps = track.getCapabilities() as { torch?: unknown } | null | undefined;
    return caps?.torch === true || (Array.isArray(caps?.torch) && caps.torch.includes(true));
  } catch {
    return false;
  }
}

/**
 * Turns the light on or off. Resolves to the state the light is in afterwards: the asked-for
 * state when the phone accepted it, otherwise the opposite (so the button never lies).
 */
export async function setTorch(track: TorchTrack | null | undefined, on: boolean): Promise<boolean> {
  if (!torchSupported(track)) return false;
  try {
    await track!.applyConstraints!({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return on;
  } catch {
    return !on;
  }
}

/** Label for the light button, read by screen readers together with aria-pressed. */
export function torchButtonLabel(on: boolean): string {
  return on ? "Light off" : "Light on";
}

/** The dark-room hint, pointing at the light button when the phone has one and it is off. */
export function darkHintWithTorch(base: string, torchAvailable: boolean, torchOn: boolean): string {
  if (!torchAvailable || torchOn) return base;
  return `${base} Or tap Light on to use the phone's light.`;
}
