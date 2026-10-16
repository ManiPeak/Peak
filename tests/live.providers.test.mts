/**
 * تست‌های زندهٔ سرویس‌های واقعی — فقط با اجازهٔ صریح اجرا می‌شوند
 *
 *   PEAK_RUN_LIVE_TESTS=1 npm run test:live
 *
 * بدون این متغیر، همهٔ تست‌ها «رد شده (skip)» اعلام می‌شوند —
 * یعنی هرگز وانمود نمی‌کنیم که به اینترنت وصل بوده‌ایم.
 *
 * پیش‌نیازها:
 *   • Ollama:  متغیر OLLAMA_BASE_URL یا سرویس روی 127.0.0.1:11434
 *   • OpenRouter: متغیر OPENROUTER_API_KEY
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LIVE = process.env.PEAK_RUN_LIVE_TESTS === "1";
const skipReason = LIVE
  ? false
  : "تست زنده فعال نیست — با PEAK_RUN_LIVE_TESTS=1 اجرا کنید";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "peak-live-test-"));
process.env.DASTIAR_DB_PATH = path.join(TMP_DIR, "live.sqlite");
process.env.PEAK_LOG_LEVEL = "error";

const { getAdapter, resolveConfig } = await import("@/lib/providers");

describe("تست زندهٔ Ollama (واقعی)", () => {
  test("سرویس در دسترس است و مدل نصب‌شده پاسخ می‌دهد", { skip: skipReason }, async () => {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl,
      model: process.env.OLLAMA_MODEL ?? "",
      apiKey: ""
    });
    const checks = await getAdapter("ollama").check(cfg);
    const report = checks
      .map((c) => `${c.status} — ${c.label}: ${c.detail}`)
      .join("\n");
    assert.ok(
      checks.every((c) => c.status === "PASS"),
      `همهٔ بررسی‌ها باید PASS شوند:\n${report}`
    );
  });
});

describe("تست زندهٔ OpenRouter (واقعی)", () => {
  test("کلید معتبر است و یک تولید کوچک انجام می‌شود", { skip: skipReason }, async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // بدون کلید، تست «نبودِ کلید» را بررسی می‌کنیم و FAIL مورد انتظار داریم
      const cfg = resolveConfig({
        provider: "openrouter",
        baseUrl: "",
        model: "openai/gpt-4o-mini",
        apiKey: ""
      });
      const checks = await getAdapter("openrouter").check(cfg);
      const auth = checks.find((c) => c.id === "auth")!;
      assert.equal(auth.status, "FAIL");
      assert.match(auth.detail, /کلید API وارد نشده/);
      return;
    }
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: "",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      apiKey
    });
    const checks = await getAdapter("openrouter").check(cfg);
    const report = checks.map((c) => `${c.status} — ${c.detail}`).join("\n");
    assert.ok(
      checks.every((c) => c.status === "PASS"),
      `همهٔ بررسی‌ها باید PASS شوند:\n${report}`
    );
  });
});