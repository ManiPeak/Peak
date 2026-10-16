/**
 * تست‌های موتور تشخیص — ساختار گزارش و صداقت وضعیت‌ها
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MockProvider } from "./helpers/mock-provider";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "peak-diag-test-"));
process.env.DASTIAR_DB_PATH = path.join(TMP_DIR, "diag.sqlite");
process.env.PEAK_LOG_LEVEL = "error";

const { runDiagnostics, backendChecks } = await import("@/lib/diagnostics");
const { saveSettings } = await import("@/lib/store");
const { startMockProvider } = await import("./helpers/mock-provider");

const VALID_STATUSES = new Set(["PASS", "FAIL", "NOT_TESTED", "SKIPPED"]);

describe("موتور تشخیص", () => {
  let mock: MockProvider;

  before(async () => {
    mock = await startMockProvider({ models: ["llama3.2:3b"], reply: "پاسخ" });
  });
  after(async () => {
    await mock.close();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test("گزارش ساختار درست دارد و هیچ رازی در آن نیست", async () => {
    // ارائه‌دهنده‌ای که کلید نگه می‌دارد تا مسیر ماسک‌کردن واقعاً تست شود
    saveSettings({
      provider: "openrouter",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "openai/gpt-4o-mini",
      apiKey: "sk-super-secret-key-123456",
      autoMemory: false
    });
    const report = await runDiagnostics();
    const serialized = JSON.stringify(report);

    assert.ok(report.generatedAt);
    assert.ok(report.runtime.node);
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length > 0);
    for (const check of report.checks) {
      assert.ok(VALID_STATUSES.has(check.status), `وضعیت نامعتبر: ${check.status}`);
      assert.ok(check.label && check.detail, "هر بررسی باید عنوان و جزئیات داشته باشد");
    }
    // کلید API هرگز نباید در گزارش کامل دیده شود
    assert.ok(!serialized.includes("sk-super-secret-key-123456"), "کلید در گزارش نشت کرد!");
    assert.match(report.provider.apiKeyMasked, /^•+|^\.\.\./);
    assert.ok(report.provider.apiKeyMasked.includes("3456"), "۴ نویسهٔ آخر باید باقی بماند");
  });

  test("با پیکربندی کامل و سرویس سالم، همهٔ مراحل بحرانی PASS می‌شوند", async () => {
    saveSettings({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: "",
      autoMemory: false
    });
    const report = await runDiagnostics();
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    assert.equal(byId.config, "PASS");
    assert.equal(byId.reachability, "PASS");
    assert.equal(byId.models, "PASS");
    assert.equal(byId.model, "PASS");
    assert.equal(byId.generation, "PASS");
    assert.equal(byId.database, "PASS");
    assert.equal(report.summary.fail, 0);
    assert.equal(report.ok, true);
  });

  test("سرویس مرده → FAIL با راهنمای عملی، و بقیهٔ بررسی‌ها SKIPPED", async () => {
    saveSettings({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:45999",
      model: "llama3.2:3b",
      apiKey: "",
      autoMemory: false
    });
    const report = await runDiagnostics();
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    assert.equal(byId.reachability, "FAIL");
    assert.equal(byId.generation, undefined, "وقتی سرویس مرده است، تست تولید نباید وانمود PASS شود");
    assert.equal(report.ok, false);
    const reach = report.checks.find((c) => c.id === "reachability")!;
    assert.match(reach.hint ?? "", /ollama serve/i);
  });

  test("پیکربندی ناقص → تست شبکه SKIPPED می‌شود (ادعای الکی نمی‌کنیم)", async () => {
    saveSettings({
      provider: "openrouter",
      baseUrl: "",
      model: "",
      apiKey: "",
      autoMemory: false
    });
    const report = await runDiagnostics();
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    assert.equal(byId.config, "FAIL");
    assert.equal(byId.provider, "SKIPPED");
  });

  test("پیکربندی موقت بدون ذخیره‌سازی تست می‌شود", async () => {
    saveSettings({
      provider: "builtin",
      baseUrl: "https://text.pollinations.ai/",
      model: "assistant",
      apiKey: "",
      autoMemory: false
    });
    const report = await runDiagnostics({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b"
    });
    assert.equal(report.provider.id, "ollama");
    assert.equal(report.summary.fail, 0);
  });

  test("بررسی‌های پایهٔ بک‌اند شامل دیتابیس است", () => {
    const checks = backendChecks();
    const db = checks.find((c) => c.id === "database")!;
    assert.equal(db.status, "PASS");
    assert.ok(checks.some((c) => c.id === "minecraft"));
  });
});