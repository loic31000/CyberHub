import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_STATES,
  interpolatePoint,
  projectAnchor,
  resolveStory,
} from "../src/story-engine.js";

const markers = [0, 100, 200, 300, 400, 500, 600, 700];

test("la progression déclarative couvre chaque état dans l'ordre et revient en arrière", () => {
  assert.deepEqual(
    STORY_STATES.map((state) => state.id),
    [
      "terminal-found",
      "ioc-imported",
      "correlation-linked",
      "references-explored",
      "disciplines-explored",
      "investigation-attached",
      "playbook-reviewed",
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
  assert.equal(resolveStory(900, markers).active, 7);
});

test("le point partagé suit une interpolation réversible et se projette dans la fenêtre", () => {
  const a = { x: 30, y: 50 },
    b = { x: 180, y: 250 };
  assert.deepEqual(interpolatePoint(a, b, 0), a);
  assert.deepEqual(interpolatePoint(a, b, 1), b);
  assert.deepEqual(interpolatePoint(a, b, 0.5), { x: 105, y: 150 });
  assert.deepEqual(interpolatePoint(b, a, 0.5), { x: 105, y: 150 });
  assert.deepEqual(
    projectAnchor(
      { left: 10, top: 200, width: 100, height: 20 },
      { width: 400, height: 800 },
      350,
    ),
    { x: 60, y: 210 },
  );
  assert.deepEqual(
    projectAnchor(
      { left: 10, top: 1200, width: 100, height: 20 },
      { width: 400, height: 800 },
      350,
    ),
    { x: 350, y: 700 },
  );
});
