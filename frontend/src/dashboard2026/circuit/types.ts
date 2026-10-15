import type { Tone } from "./timing";

/* Types of the board: rectangles, parts, routes, journeys, layers, the hero board and its link. */

export type Rect = { x: number; y: number; w: number; h: number; globe?: boolean; role?: "hero" | "env" | "widget" | "foot" };

export type Point = { x: number; y: number };

export type Side = "l" | "r" | "t" | "b";

export type Part = { id?: number; x: number; y: number; w: number; h: number; ports: Record<Side, Point[]>; used: Record<Side, number> };

export type Route = { d: string; length: number; points: Point[] };

export type Link = { route: Route; a: number; b: number };

export type Box = { x: number; y: number; w: number; h: number };

/*
 * A journey: one LED leaves a chip, follows a visible trace, enters the next
 * chip (which glows), waits there, leaves through another pin, and so on,
 * moving towards the main processor. Times are in seconds within `period`.
 */
export type Journey = {
  tone: Tone;
  rare: boolean;
  period: number;
  delay: number;
  hops: (Route & { start: number; end: number })[];
  glows: (Box & { start: number; end: number; over?: boolean })[];
};

/* The main processor beats on the strong beats of the bar, like a kick drum. */
export type Heartbeat = Box & { period: number; beats: number[] };

export type BoardLayer =
  | "backbone" | "trace" | "bus" | "shadow" | "body" | "die" | "heat" | "slot" | "pin"
  | "pad" | "cap" | "ball" | "via" | "hole" | "mark";

export const LAYERS: BoardLayer[] = [
  "backbone", "trace", "bus", "shadow", "body", "die", "heat", "slot", "pin", "pad", "cap", "ball", "via", "hole", "mark",
];

type Variant = "a" | "b";

/* The hero card, its processor band, where its copy ends and its index starts, and the board's origin in the workspace. */
export type HeroAnchor = { hero: Box; band: Box; copyRight: number; indexLeft: number; board: Point; variant: Variant; feeds: FeedRoom | null };

/* Room for CH's feeds: set when the open band below the environment card can hold the relay chip, with what that band must keep clear. */
export type FeedRoom = { keepout: Box[] };

/*
 * A module page's processor feeding the board, as the CH processor feeds the
 * Dashboard's: its edge connector (board coordinates), the processor-to-
 * connector paths, where the relay chip sits, and a schedule shared with the
 * module hero's own pulses. Above `clearAbove` (the module's header band) the
 * board places no part. Used by module pages only; the Dashboard passes none.
 */
export type ModuleFeed = {
  clearAbove: number;
  link: HeroLink;
  heroPaths: Point[][];
  chip: Box;
  relayTop: number;
  keepout: Box[];
  schedule: { cycle: number; start: number; trip: number };
  /* Where no part may sit (readable text, controls, the feed corridor): elsewhere the board fills the free space. */
  avoid?: Box[];
  /* Where the relay may sit: offset from the connector and top, best first. */
  spots?: { dx: number; top: number }[];
};

/* The link connector: its body, its signal pins (x), unwired pins, and the tips of its upper and lower pins. */
export type HeroLink = Box & { variant: Variant; pins: number[]; dummies: number[]; top: number; bottom: number };

export type EnvironmentLink = Box & { pins: number[]; top: number; bottom: number };

/* The hero's own small board, in board coordinates. */
export type HeroBoard = Box & { layers: Record<BoardLayer, string>; chip: Box; link: HeroLink | null; envLink: EnvironmentLink | null; board: Point };

export type CircuitGeometry = {
  width: number;
  height: number;
  widgetTop: number;
  obstacles: Rect[];
  layers: Record<BoardLayer, string>;
  journeys: Journey[];
  heartbeat: Heartbeat | null;
  hero: HeroBoard | null;
  boardKey: string; // changes only when the static drawing changes
  revision?: number;
  fed?: boolean; // a module page's processor drives the journeys
};
