import assert from "node:assert/strict";
import test from "node:test";
import {
  getLastCompletedLeadMeasure,
  getNextWigCompletionState,
  getWigCompletionScore,
  isLeadMeasureComplete,
} from "./wigCompletion";

test("a lead measure is complete when approved total reaches target", () => {
  assert.equal(
    isLeadMeasureComplete({
      id: "lm-1",
      targetValue: 10,
      activityLogs: [{ value: 4 }, { value: 6 }],
    }),
    true,
  );
});

test("WIG remains active until every lead measure is complete", () => {
  const state = getNextWigCompletionState({
    fromValue: 100,
    status: "ACTIVE",
    closedAt: null,
    leadMeasures: [
      { id: "lm-1", targetValue: 10, activityLogs: [{ value: 10 }] },
      { id: "lm-2", targetValue: 5, activityLogs: [{ value: 4 }] },
    ],
  });

  assert.equal(state.status, "ACTIVE");
  assert.equal(state.closedAt, null);
});

test("WIG closes as achieved when all lead measures are complete", () => {
  const now = new Date("2026-05-25T08:00:00.000Z");
  const state = getNextWigCompletionState(
    {
      fromValue: 100,
      status: "ACTIVE",
      closedAt: null,
      leadMeasures: [
        { id: "lm-1", targetValue: 10, activityLogs: [{ value: 12 }] },
        { id: "lm-2", targetValue: 5, activityLogs: [{ value: 5 }] },
      ],
    },
    now,
  );

  assert.equal(state.status, "ACHIEVED");
  assert.equal(state.closedAt, now);
  assert.equal(state.achieved, true);
});

test("completion score is normalized across mixed lead measure units", () => {
  assert.equal(
    getWigCompletionScore([
      { id: "calls", targetValue: 100, activityLogs: [{ value: 100 }] },
      { id: "revenue", targetValue: 1000000, activityLogs: [{ value: 500000 }] },
    ]),
    75,
  );
});

test("last completed lead measure identifies the final lead measure to cross target", () => {
  const lastCompleted = getLastCompletedLeadMeasure([
    {
      id: "lm-1",
      name: "Calls",
      targetValue: 10,
      activityLogs: [
        { value: 5, loggedForDate: "2026-05-20T00:00:00.000Z" },
        { value: 5, loggedForDate: "2026-05-21T00:00:00.000Z" },
      ],
    },
    {
      id: "lm-2",
      name: "Demos",
      targetValue: 2,
      activityLogs: [
        { value: 1, loggedForDate: "2026-05-22T00:00:00.000Z" },
        { value: 1, loggedForDate: "2026-05-23T00:00:00.000Z" },
      ],
    },
  ]);

  assert.equal(lastCompleted?.id, "lm-2");
  assert.equal(lastCompleted?.name, "Demos");
});
