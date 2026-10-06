import test from "node:test";
import assert from "node:assert/strict";
import { weightedGpa, defaultBasisYear, rankStudents, parseView } from "../lib/academics.js";

const W = { 1: 5, 2: 10, 3: 10, 4: 15, 5: 20, 6: 40 };
const near = (a, b) => Math.abs(a - b) < 1e-3;

test("weighted GPA over the entered years, weights not redistributed to zero", () => {
  const r = weightedGpa({ 1: 3.5, 2: 3.0 }, W);
  assert.ok(near(r.gpa, 3.1667));
  assert.deepEqual(r.years, [1, 2]);
  assert.equal(r.final, false);
});

test("through limits the years and decides eligibility", () => {
  assert.equal(weightedGpa({ 1: 3, 2: 3 }, W, 2).eligible, true);
  assert.equal(weightedGpa({ 1: 3, 3: 3 }, W, 3).eligible, false); // year 2 missing
  assert.equal(weightedGpa({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4 }, W).final, true);
  assert.ok(near(weightedGpa({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4 }, W).gpa, 3.4));
});

test("students at different stages: cumulative ranking compares only the eligible", () => {
  const items = [
    { id: "A", yg: { 1: 3.9 } },
    { id: "B", yg: { 1: 3.5, 2: 3.5 } },
    { id: "C", yg: { 1: 3.0, 2: 3.0, 3: 3.0 } },
  ];
  const basis = defaultBasisYear(items.map((i) => i.yg), W);
  assert.equal(basis, 2);
  const rank = rankStudents(items, (i) => { const c = weightedGpa(i.yg, W, basis); return c.eligible ? c.gpa : null; });
  assert.equal(rank("B").all.rank, 1);
  assert.equal(rank("C").all.rank, 2);
  assert.equal(rank("A").all.rank, null); // only Year 1 done: not compared
  assert.equal(rank.rankedCount, 2);
});

test("ties share a rank and groups are ranked separately", () => {
  const items = [
    { id: "a", v: 3.5, g: "23" }, { id: "b", v: 3.5, g: "24" }, { id: "c", v: 3.0, g: "23" }, { id: "d", v: null, g: "24" },
  ];
  const rank = rankStudents(items, (i) => i.v, (i) => i.g);
  assert.deepEqual([rank("a").all.rank, rank("b").all.rank, rank("c").all.rank], [1, 1, 3]);
  assert.equal(rank("a").all.tie, true);
  assert.equal(rank("c").group.rank, 2);
  assert.equal(rank("d").all.rank, null);
});

test("view parameter", () => {
  const ctx = { maxYear: 6, defaultYear: 1, basis: 2 };
  assert.deepEqual(parseView("cum3", ctx), { kind: "cumulative", through: 3 });
  assert.deepEqual(parseView("9", ctx), { kind: "year", year: 6 });
  assert.deepEqual(parseView("", ctx), { kind: "year", year: 1 });
});
