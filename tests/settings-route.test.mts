/**
 * تست‌های مسیر تنظیمات — اعتبارسنجی، پذیرش ارائه‌دهندهٔ اختیاری و عدم نشت کلید
 *
 * این تست‌ها هندلر واقعی Next.js را مستقیم صدا می‌زنند (بدون شبکهٔ بیرونی).
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "peak-settings-test-"));
process.env.DASTIAR_DB_PATH = path.join(TMP_DIR, "test.sqlite");
process.env.PEAK_LOG_LEVEL = "error";

const { PUT, GET } = await import("@/app/api/settings/route");

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/settings", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("مسیر تنظیمات — اعتبارسنجی", () => {
  after(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test("ارائه‌دهندهٔ ناشناخته رد می‌شود (۴۰۰)", async () => {
    const res = await PUT(makeRequest("PUT", { provider: "definitely-not-real" }) as never);
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error?: string };
    assert.match(json.error ?? "", /ارائه‌دهنده/i);
  });

  test("9router (پروکسی محلی اختیاری) پذیرفته می‌شود", async () => {
    const res = await PUT(
      makeRequest("PUT", {
        provider: "9router",
        baseUrl: "http://127.0.0.1:20128/v1",
        model: "some-model"
      }) as never
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as { settings?: { provider?: string } };
    assert.equal(json.settings?.provider, "9router");
  });

  test("baseUrl نامعتبر (بدون http) رد می‌شود", async () => {
    const res = await PUT(
      makeRequest("PUT", { provider: "ollama", baseUrl: "127.0.0.1:11434" }) as never
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error?: string };
    assert.match(json.error ?? "", /http/i);
  });

  test("پاسخ GET هرگز کلید واقعی را برنمی‌گرداند", async () => {
    await PUT(
      makeRequest("PUT", {
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "openai/gpt-4o-mini",
        apiKey: "sk-or-v1-super-secret-key-1234567890"
      }) as never
    );
    const res = await GET(makeRequest("GET") as never);
    assert.equal(res.status, 200);
    const raw = JSON.stringify(await res.json());
    assert.ok(!raw.includes("super-secret-key-1234567890"), "کلید نباید در پاسخ باشد");
    assert.match(raw, /apiKeyMasked/);
  });
});