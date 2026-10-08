import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const noComments = (sql) => sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
const schema = noComments(read("supabase/schema.sql"));

function sourceFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : sourceFiles(rel);
    return /\.(js|mjs)$/.test(e.name) ? [rel] : [];
  });
}

test("every table the code reads exists in schema.sql", () => {
  const created = new Set([...schema.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]));
  const used = new Set();
  for (const f of [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("scripts")]) {
    for (const m of read(f).matchAll(/\.from\("(\w+)"\)/g)) used.add(m[1]);
  }
  const missing = [...used].filter((t) => !created.has(t));
  assert.deepEqual(missing, [], `tables used in code but not created in schema.sql: ${missing}`);
});

test("every SQL function the schema calls is defined in it", () => {
  const defined = new Set([...schema.matchAll(/create (?:or replace )?function public\.(\w+)/gi)].map((m) => m[1]));
  const called = [...schema.matchAll(/^\s*select\s+public\.(\w+)\(/gim)].map((m) => m[1]);
  const missing = called.filter((f) => !defined.has(f));
  assert.deepEqual(missing, [], `functions called but not defined: ${missing}`);
});
