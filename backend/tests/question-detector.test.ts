import assert from "node:assert/strict";
import test from "node:test";
import { isInterviewQuestion } from "../src/modules/questions/question-detector.js";

test("detects common interview prompts", () => {
  assert.equal(isInterviewQuestion("Tell me about yourself"), true);
  assert.equal(isInterviewQuestion("Why this role?"), true);
  assert.equal(isInterviewQuestion("Can you describe a time you resolved a conflict?"), true);
});

test("ignores filler, small talk, and incomplete fragments", () => {
  assert.equal(isInterviewQuestion("Um, okay."), false);
  assert.equal(isInterviewQuestion("How was your weekend?"), false);
  assert.equal(isInterviewQuestion("Tell me about"), false);
  assert.equal(isInterviewQuestion("Can you tell me"), false);
  assert.equal(isInterviewQuestion("What did you"), false);
});

test("removes a leading filler without losing a complete question", () => {
  assert.equal(isInterviewQuestion("Um, tell me about your latest project."), true);
});
