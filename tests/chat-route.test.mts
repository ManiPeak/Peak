/**
 * تست‌های مسیر چت — اجرای مستقیم هندلر واقعی Next.js (بدون شبکهٔ بیرونی)
 *
 * هدف اصلی: جلوگیری از بازگشت HTTP 500 و اطمینان از اینکه
 *  • ورودی نامعتبر → 400 با کد مشخص (نه 500)
 *  • مسیر موفق → 200 با هدرهای درست و متن درست
 *  • خرابی ارائه‌دهنده → سقوط به آفلاین با پیام گویا (نه 500)
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MockProvider } from "./helpers/mock-provider";

// دیتابیس موقت و جدا برای تست‌ها — باید پیش از ایمپورت ماژول‌ها ست شود
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "peak-chat-test-"));
process.env.DASTIAR_DB_PATH = path.join(TMP_DIR, "test.sqlite");
process.env.PEAK_LOG_LEVEL = "error";

const { POST } = await import("@/app/api/chat/route");
const { saveSettings, getSettings } = await import("@/lib/store");
const { startMockProvider } = await import("./helpers/mock-provider");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

async function readText(res: Response): Promise<string> {
  return res.text();
}

describe("مسیر چت — HTTP", () => {
  let mock: MockProvider;

  before(async () => {
    mock = await startMockProvider({
      models: ["llama3.2:3b"],
      reply: "این پاسخ از سرور آزمایشی آمد."
    });
  });

  after(async () => {
    await mock.close();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test("content غیررشته‌ای → 400 با کد INVALID_CONTENT (رگرسیونِ HTTP 500)", async () => {
    for (const bad of [123, true, { a: 1 }, ["سلام"]]) {
      const res = await POST(makeRequest({ content: bad }) as never);
      assert.equal(res.status, 400, `payload ${JSON.stringify(bad)} نباید 500 بدهد`);
      const json = (await res.json()) as { code?: string; error?: string };
      assert.equal(json.code, "INVALID_CONTENT");
      assert.ok(json.error);
    }
  });

  test("بدنهٔ JSON خراب → 400 نه 500", async () => {
    const res = await POST(makeRequest("{not json") as never);
    assert.equal(res.status, 400);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "INVALID_JSON");
  });

  test("بدنهٔ آرایه‌ای یا تهی → 400", async () => {
    const a = await POST(makeRequest([1, 2, 3]) as never);
    assert.equal(a.status, 400);
    const b = await POST(makeRequest(null) as never);
    assert.equal(b.status, 400);
  });

  test("پیام خالی → 400 با کد EMPTY_CONTENT", async () => {
    const res = await POST(makeRequest({ content: "   " }) as never);
    assert.equal(res.status, 400);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "EMPTY_CONTENT");
  });

  test("پیام بیش از حد طول → 413", async () => {
    const res = await POST(makeRequest({ content: "ا".repeat(9000) }) as never);
    assert.equal(res.status, 413);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "CONTENT_TOO_LONG");
  });

  test("conversationId نامعتبر (رشته/عدد بزرگ) → گفتگوی جدید ساخته می‌شود، نه خطا", async () => {
    saveSettings({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: "",
      autoMemory: false
    });
    for (const convId of ["abc", 999999, null, -1]) {
      const res = await POST(makeRequest({ content: "سلام", conversationId: convId }) as never);
      assert.equal(res.status, 200);
      assert.ok(Number(res.headers.get("X-Conversation-Id")) > 0);
    }
  });

  test("پاسخ موفق: 200 با هدرهای واقعی و متن مدل", async () => {
    saveSettings({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: "",
      autoMemory: false
    });
    const res = await POST(
      makeRequest({ content: "یک پرسش آزمایشی که باید به مدل برسد" }) as never
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-Provider"), "ollama");
    assert.equal(res.headers.get("X-Model"), "llama3.2:3b");
    assert.equal(res.headers.get("X-Reply-Mode"), "llm");
    assert.equal(res.headers.get("X-Provider-Error"), null);
    const text = await readText(res);
    assert.match(text, /این پاسخ از سرور آزمایشی آمد/);
  });

  test("ارائه‌دهندهٔ مرده → 200 با سقوط به آفلاین و دلیل گویا (بدون 500)", async () => {
    saveSettings({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:45999", // پورت بسته
      model: "llama3.2:3b",
      apiKey: "",
      autoMemory: false
    });
    const res = await POST(
      makeRequest({ content: "یک پرسش آزمایشی که باید به مدل برسد" }) as never
    );
    assert.equal(res.status, 200, "خرابی ارائه‌دهنده نباید 500 بدهد");
    assert.equal(res.headers.get("X-Reply-Mode"), "offline");
    assert.equal(res.headers.get("X-Provider-Error"), "1");
    const text = await readText(res);
    assert.match(text, /ارائه‌دهندهٔ «ollama» پاسخ نداد/);
  });

  test("تنظیمات خراب (بدون مدل) → پاسخ آفلاین، بدون 500", async () => {
    saveSettings({
      provider: "custom",
      baseUrl: "",
      model: "",
      apiKey: "",
      autoMemory: false
    });
    const res = await POST(makeRequest({ content: "سلام" }) as never);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-Reply-Mode"), "offline");
    await readText(res);
  });

  test("مسیر حافظه کار می‌کند و حالت memory برمی‌گرداند", async () => {
    saveSettings({ provider: "ollama", baseUrl: mock.baseUrl, model: "llama3.2:3b", apiKey: "" });
    const res = await POST(
      makeRequest({ content: "این رو یادت بمونه: تست خودکار Peak" }) as never
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-Reply-Mode"), "memory");
    const text = await readText(res);
    assert.match(text, /یاد گرفتم/);
  });

  test("تنظیمات ذخیره‌شده بعد از تست‌ها سالم می‌ماند", () => {
    const s = getSettings();
    assert.ok(s.provider);
    assert.equal(typeof s.model, "string");
  });
});