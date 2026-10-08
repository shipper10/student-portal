import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { relSemester, SEMESTERS_OF, COURSE_LEVELS } from "../lib/academics.js";

const root = path.resolve(import.meta.dirname, "..");

test("first/second semester of each year", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12].map(relSemester), [1, 2, 1, 2, 1, 2]);
  assert.deepEqual(SEMESTERS_OF.sem1, [1]);
  assert.deepEqual(SEMESTERS_OF.both, [1, 2]);
  assert.deepEqual(SEMESTERS_OF.none, []);
  assert.deepEqual(COURSE_LEVELS, ["none", "sem1", "sem2", "both"]);
});

test("the exported profile picture never shows the university ID or the cohort", () => {
  const src = fs.readFileSync(path.join(root, "app/components/profile/ShareSheet.js"), "utf8");
  assert.doesNotMatch(src, /student_id|\.cohort\b|cohort:/);
});
