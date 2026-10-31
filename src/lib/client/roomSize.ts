import { DEFAULT_ROOM_SIZE, isRoomSize, type RoomSize } from "./duration";

/**
 * The room size picked on the upload screen (Small, Medium, Large, Extra large), kept in this browser's
 * localStorage so a tester filming the same building picks once. It sets the length rules in duration.ts.
 */
export const ROOM_SIZE_KEY = "sightwork:roomSize";

/** The saved size, or Medium. Never throws (storage off, a value from an older build). */
export function loadRoomSize(): RoomSize {
  try {
    if (typeof window === "undefined") return DEFAULT_ROOM_SIZE;
    const v = window.localStorage.getItem(ROOM_SIZE_KEY);
    return isRoomSize(v) ? v : DEFAULT_ROOM_SIZE;
  } catch {
    return DEFAULT_ROOM_SIZE;
  }
}

export function saveRoomSize(size: RoomSize): void {
  try {
    if (isRoomSize(size)) window.localStorage.setItem(ROOM_SIZE_KEY, size);
  } catch {
    /* storage off: the size just isn't remembered */
  }
}
