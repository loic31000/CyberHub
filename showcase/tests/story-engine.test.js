import assert from "node:assert/strict";
import test from "node:test";
import { STORY_STATES, resolveStory } from "../src/story-engine.js";

const markers = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];

test("la progression déclarative couvre chaque état dans l'ordre et revient en arrière", () => {
  assert.deepEqual(
    STORY_STATES.map((state) => state.id),
    [
      "terminal-found",
      "ioc-imported",
      "correlation-linked",
      "references-explored",
      "investigation-attached",
      "playbook-reviewed",
      "disciplines-explored",
      "osint-explored",
      "bgp-compared",
      "cyberhub-revealed",
    ],
  );
  const forward = markers.map(
    (point) => STORY_STATES[resolveStory(point, markers).active].id,
  );
  assert.deepEqual(
    forward,
    STORY_STATES.map((state) => state.id),
  );
  const backward = markers
    .toReversed()
    .map((point) => STORY_STATES[resolveStory(point, markers).active].id);
  assert.deepEqual(backward, forward.toReversed());
  assert.equal(resolveStory(550, markers).active, 6);
  assert.equal(resolveStory(-100, markers).active, 0);
  assert.equal(resolveStory(1100, markers).active, 9);
});
