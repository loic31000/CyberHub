/* The board plays in time: one beat, a 12-beat bar shared by every journey, and the LED tones. */

export type Tone = "cyan" | "blue" | "white" | "amber";

// One LED per journey, so at most five travel at once; amber is occasional.
export const JOURNEY_TONES: Tone[] = ["cyan", "blue", "cyan", "white", "amber"];

// The board plays in time: one beat, a 12-beat bar shared by every journey.
export const BEAT = 0.9; // seconds

export const BAR = 12; // beats

export const SPEED = 80; // px per second, before snapping to the beat

export const START_BEATS = [0, 2, 5, 8, 10]; // each journey enters on its own beat
