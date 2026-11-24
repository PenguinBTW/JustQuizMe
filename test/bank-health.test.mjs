// Node-level tests for the bank-health scanner against a synthetic tree —
// no real question bank required. Run: node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { scanQuestionsDir, buildBankHealthReport } = require("../server/services/bank-health.js");

function makeBank(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jqm-bank-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (category, file, content) => {
    const cat = path.join(dir, category);
    fs.mkdirSync(cat, { recursive: true });
    fs.writeFileSync(path.join(cat, file), content);
  };
  write("normal", "algebra.json", JSON.stringify({
    uuid: "quiz-1",
    title: "Algebra",
    questions: [
      { id: "q1", type: "multiple-choice", prompt: "Solve x", marks: 3, options: ["a", "b"], correctIndex: 0 },
      { id: "q2", type: "written", prompt: "Factor", marks: 2, markScheme: ["b"] }, // no options — valid written
      { id: "q3", type: "multiple-choice", marks: 4, options: ["x"], correctIndex: 0 }, // missing title/prompt
      { id: "q5", type: "multiple-choice", prompt: "Pick", marks: 1, correctIndex: 0 }, // missing options
      { id: "q6", type: "trace-table", prompt: "Trace", mark: 5, expectedRows: [] }   // mark alias + expectedRows answer
    ]
  }));
  write("past-paper", "2024-p1.json", JSON.stringify({
    uuid: "quiz-2",
    questions: [
      { id: "q1", type: "multiple-choice", prompt: "Reused id, different quiz", marks: 5, options: ["y"], correctIndex: 0 },
      { id: "q4", type: "multiple-choice", prompt: "No marks", options: ["z"], correctIndex: 0 }, // missing marks
      { id: "q1", type: "written", prompt: "Dup inside same manifest", marks: 5, markScheme: ["y"] } // within-file duplicate
    ]
  }));
  write("normal", "nouuid.json", JSON.stringify({ questions: [{ id: "x" }] }));
  write("normal", "broken.json", "{ not json");
  write("normal", "noquestions.json", JSON.stringify({ uuid: "quiz-3" }));
  fs.writeFileSync(path.join(dir, "normal", "notes.txt"), "not a manifest");
  return dir;
}

test("scanQuestionsDir totals quizzes, questions, and marks", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.equal(report.missingDir, false);
  assert.equal(report.totalQuizzes, 2);
  assert.equal(report.totalQuestions, 8);
  assert.equal(report.totalMarks, 25);
});

test("scanQuestionsDir counts missing fields and keeps samples", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.equal(report.missingFields.title, 1);
  assert.equal(report.missingFields.options, 1);
  assert.equal(report.missingFields.marks, 1);
  assert.equal(report.missingFields.id, 0);
  assert.equal(report.missingFields.answer, 0);
  assert.deepEqual(report.missingFieldSamples.title, ["normal/algebra.json#q3"]);
  assert.ok(report.missingFieldSamples.options.includes("normal/algebra.json#q5"));
});

test("scanQuestionsDir reports marks distribution", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.deepEqual(report.marksDistribution, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 3 });
});

test("scanQuestionsDir flags duplicates only within one manifest", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.equal(report.duplicateIds.length, 1);
  assert.equal(report.duplicateIds[0].id, "q1");
  assert.equal(report.duplicateIds[0].count, 2);
  assert.equal(report.duplicateIds[0].file, "past-paper/2024-p1.json");
});

test("scanQuestionsDir lists skipped files with reasons, ignores non-JSON", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.equal(report.skippedFiles.length, 3);
  const byFile = Object.fromEntries(report.skippedFiles.map((f) => [f.file, f.reason]));
  assert.equal(byFile["normal/broken.json"], "invalid JSON");
  assert.equal(byFile["normal/noquestions.json"], "no questions array");
  assert.equal(byFile["normal/nouuid.json"], "no uuid");
});

test("scanQuestionsDir handles a missing bank directory", () => {
  const report = scanQuestionsDir("/nonexistent/jqm-bank");
  assert.equal(report.missingDir, true);
  assert.equal(report.totalQuizzes, 0);
});

test("written/trace-table questions need no options and report no absolute path", (t) => {
  const report = scanQuestionsDir(makeBank(t));
  assert.equal(report.missingFields.answer, 0); // markScheme + expectedRows count as answers
  assert.equal(report.questionsDir, undefined); // server path stays out of the payload
});

test("buildBankHealthReport folds portals together", (t) => {
  const dir = makeBank(t);
  const report = buildBankHealthReport({
    maths: { name: "Mathematics", spec: "OCR H240", questionsDir: dir },
    physics: { name: "Physics", spec: "AQA 7408", questionsDir: "/nonexistent/jqm-bank" }
  });
  assert.ok(report.generatedAt);
  assert.equal(report.portals.maths.totalQuestions, 8);
  assert.equal(report.portals.maths.spec, "OCR H240");
  assert.equal(report.portals.physics.missingDir, true);
});
