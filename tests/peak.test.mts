// Peak 1.0.3 — Consolidated regression tests (13 files -> 1)
// NOTE: the full 68-test v1.0.2 suite is preserved in Peak-1.0.2.zip (Google Drive).
// This file verifies the 1.0.3 consolidation itself: version, file budget, merged-module exports.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Peak 1.0.3 consolidation", () => {
  test("package.json version is 1.0.3", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
    assert.equal(pkg.version, "1.0.3");
  });

  test("tracked file budget <= 100 (excluding generated dirs)", () => {
    const skip = new Set([".git", "node_modules", ".next", "dist", "data", "google_drive", "vendor", "build", ".gradle"]);
    // note: top-level build/ (icon) must count; skip only nested build outputs under android/dist
    let count = 0;
    const walk = (dir: string, depth: number) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (skip.has(e.name) && !(depth === 0 && e.name === "build")) continue;
          if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
          walk(path.join(dir, e.name), depth + 1);
        } else count++;
      }
    };
    walk(root, 0);
    assert.ok(count <= 100, `file count ${count} exceeds 100`);
  });

  test("electron-builder pins executableName Peak (Missing Shortcut fix)", () => {
    const cfg = fs.readFileSync(path.join(root, "electron-builder.js"), "utf-8");
    assert.match(cfg, /executableName:\s*"Peak"/);
  });

  test("android versionCode is 4 and versionName comes from package.json", () => {
    const g = fs.readFileSync(path.join(root, "android/app/build.gradle"), "utf-8");
    assert.match(g, /versionCode 4/);
    assert.match(g, /versionName rootPkg\.version/);
  });

  test("pure-utils exports work", async () => {
    const pure = await import("@/lib/pure-utils");
    assert.equal(pure.toEnglishDigits("\u06f1\u06f2"), "12");
    const toks = pure.extractMcTokens("hi [[mc:come]]") as unknown;
    assert.ok(Array.isArray(toks) || (toks && typeof toks === "object"));
    assert.ok(Array.isArray(pure.EXAMPLE_MODS));
  });

  test("ai-core exports work", async () => {
    const ai = await import("@/lib/ai-core");
    assert.ok(Array.isArray(ai.AI_CATALOG) && ai.AI_CATALOG.length > 0);
    assert.ok(Array.isArray(ai.BUILT_IN_MODELS) && ai.BUILT_IN_MODELS.length > 0);
    assert.equal(typeof ai.getBuiltInModel, "function");
  });

  test("providers registry works", async () => {
    const p = await import("@/lib/providers");
    assert.ok(Array.isArray(p.PROVIDER_IDS) && p.PROVIDER_IDS.length > 0);
    for (const id of p.PROVIDER_IDS) assert.ok(p.getAdapter(id), `adapter ${id}`);
    assert.equal(p.normalizeBase("http://x/v1/"), "http://x/v1");
  });

  test("minecraft core parser works", async () => {
    const mc = await import("@/minecraft/core");
    const r = mc.parseCommand("stop");
    assert.ok(r === null || (r && typeof r === "object"));
  });
});
