/**
 * تست‌های واحد لایهٔ ارائه‌دهنده‌ها
 *
 * ⚠️ این تست‌ها MOCK هستند: فقط شکل درخواست و تبدیل خطا را می‌سنجند،
 * نه اتصال واقعی به Ollama/OpenRouter (برای آن، تست‌های یکپارچه وجود دارد).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  getAdapter,
  resolveConfig,
  configLooksComplete,
  listProviderModels,
  completeOnce
} from "@/lib/providers";
import { describeNetworkError, errorCode } from "@/lib/providers/http";
import { redact, scrub } from "@/lib/logger";

const realFetch = globalThis.fetch;

/** نصب یک fetch ساختگی که پاسخ از پیش تعیین‌شده می‌دهد */
function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("لایهٔ ارائه‌دهنده — واحد (Mock)", () => {
  before(() => {
    globalThis.fetch = realFetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
  });

  test("پاک‌سازی رازها: کلید هرگز در متن باقی نمی‌ماند", () => {
    const leaks = [
      "Authorization: Bearer sk-or-v1-abcdef1234567890",
      "کلید من sk-proj-ABCDEFGH12345678 است",
      '{"api_key":"sk-1234567890abcdef"}',
      "https://x.dev/v1?api_key=abc123def&model=y",
      "token=ghp_1234567890abcdefghij"
    ];
    for (const leak of leaks) {
      const out = redact(leak);
      assert.ok(
        !/sk-or-v1-abcdef1234567890|sk-proj-ABCDEFGH12345678|sk-1234567890abcdef|ghp_1234567890abcdefghij/.test(out),
        `راز در خروجی مانده است: ${out}`
      );
      assert.ok(out.includes("***"), `باید ماسک داشته باشد: ${out}`);
    }
    assert.deepEqual(scrub({ apiKey: "sk-secret-value", model: "m" }), {
      apiKey: "***",
      model: "m"
    });
  });

  test("Ollama: پیکربندی به ریشهٔ بومی تبدیل می‌شود (نه /v1)", () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: "http://localhost:11434/v1/",
      model: "llama3.2:3b",
      apiKey: ""
    });
    assert.equal(cfg.baseUrl, "http://localhost:11434");
    assert.equal(cfg.model, "llama3.2:3b");
    assert.equal(cfg.apiKey, "");
  });

  test("Ollama: تنظیمات ارائه‌دهندهٔ دیگر نادیده گرفته می‌شود", () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: "https://text.pollinations.ai/",
      model: "assistant",
      apiKey: ""
    });
    assert.equal(cfg.baseUrl, "http://127.0.0.1:11434");
    assert.equal(cfg.model, "llama3.2:3b");
    assert.equal(cfg.sources.baseUrl, "default");
  });

  test("OpenRouter: آدرس رسمی + هدرهای مستندشده", async () => {
    process.env.OPENROUTER_APP_NAME = "Peak-Test";
    process.env.OPENROUTER_SITE_URL = "http://localhost:3784";
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: "",
      model: "openai/gpt-4o-mini",
      apiKey: "sk-or-v1-testtesttest1234"
    });
    assert.equal(cfg.baseUrl, "https://openrouter.ai/api/v1");

    const calls = mockFetch((url) => {
      assert.equal(url, "https://openrouter.ai/api/v1/models");
      return jsonResponse({ data: [{ id: "openai/gpt-4o-mini" }] });
    });
    await listProviderModels(cfg);
    globalThis.fetch = realFetch;

    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer sk-or-v1-testtesttest1234");
    assert.equal(headers["X-OpenRouter-Title"], "Peak-Test");
    assert.equal(headers["HTTP-Referer"], "http://localhost:3784");
  });

  test("خطای 401 ارائه‌دهنده به پیام قابل‌فهم تبدیل می‌شود", async () => {
    mockFetch(() => jsonResponse({ error: { message: "No auth credentials found" } }, 401));
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: "",
      model: "x/y",
      apiKey: "bad-key-value"
    });
    await assert.rejects(
      () => listProviderModels(cfg),
      (err: Error) => {
        assert.match(err.message, /401/);
        assert.match(err.message, /کلید API نامعتبر/);
        return true;
      }
    );
    globalThis.fetch = realFetch;
  });

  test("Ollama خطای «مدل نصب نیست» را گویا منتقل می‌کند", async () => {
    mockFetch(() => jsonResponse({ error: "model 'x' not found, try pulling it first" }, 404));
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: "",
      model: "missing-model",
      apiKey: ""
    });
    await assert.rejects(
      () => completeOnce(cfg, [{ role: "user", content: "hi" }]),
      (err: Error) => {
        assert.match(err.message, /404/);
        assert.match(err.message, /not found/);
        return true;
      }
    );
    globalThis.fetch = realFetch;
  });

  test("تایم‌اوت به خطای قابل‌فهم تبدیل می‌شود", async () => {
    const cfg = resolveConfig({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-test"
    });
    mockFetch(() => {
      const err = new Error("fetch failed");
      (err as Error & { code?: string }).code = "ECONNREFUSED";
      return Promise.reject(err);
    });
    await assert.rejects(
      () => completeOnce(cfg, [{ role: "user", content: "hi" }]),
      (err: Error) => /ECONNREFUSED|اتصال برقرار نشد/.test(err.message)
    );
    globalThis.fetch = realFetch;

    assert.equal(errorCode(new Error("x")), "");
    assert.equal(
      describeNetworkError({ code: "ECONNREFUSED" } as never).kind,
      "network"
    );
    assert.match(
      describeNetworkError({ code: "ECONNREFUSED" } as never).hint,
      /ollama serve/i
    );

    // Node جزئیات واقعی را در `cause` پنهان می‌کند («fetch failed» + «bad port»)
    const chained = new TypeError("fetch failed", {
      cause: new Error("bad port")
    });
    const chainedInfo = describeNetworkError(chained);
    assert.equal(chainedInfo.kind, "network");
    assert.match(chainedInfo.message, /پورت معتبر نیست/);

    // اتصال ردشده در زنجیرهٔ cause هم باید تشخیص داده شود
    const refused = new TypeError("fetch failed", {
      cause: new Error("connect ECONNREFUSED 127.0.0.1:11434")
    });
    assert.match(describeNetworkError(refused).message, /ECONNREFUSED|Connection refused/);
  });

  test("بررسی پیکربندی ناقص قبل از هر درخواست شبکه", () => {
    // مقادیر پیش‌فرض ارائه‌دهنده اعمال می‌شوند، ولی نبودِ کلید باید گزارش شود
    const noKey = resolveConfig({
      provider: "openrouter",
      baseUrl: "",
      model: "",
      apiKey: ""
    });
    const res = configLooksComplete(noKey);
    assert.equal(res.ok, false);
    assert.ok(res.problems.some((p) => /کلید API/.test(p)));

    // ارائه‌دهندهٔ سفارشی بدون آدرس پایه باید همان‌جا متوقف شود
    const noUrl = resolveConfig({
      provider: "custom",
      baseUrl: "",
      model: "",
      apiKey: ""
    });
    assert.equal(configLooksComplete(noUrl).ok, false);

    const good = resolveConfig({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2:3b",
      apiKey: ""
    });
    assert.equal(configLooksComplete(good).ok, true);
  });

  test("پارامترهای نامعتبر سرویس در تست connection گزارش می‌شوند", async () => {
    const { testConnection } = await import("@/lib/llm");
    const res = await testConnection({
      provider: "custom",
      baseUrl: "",
      model: "",
      apiKey: ""
    });
    assert.equal(res.ok, false);
    assert.match(res.message, /پیکربندی ناقص/);
  });

  test("استریم SSE درست پارس می‌شود (OpenAI-سازگار)", async () => {
    const adapter = getAdapter("openrouter");
    const cfg = adapter.resolve({
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-4o-mini",
      apiKey: "k"
    });
    const sse = [
      'data: {"choices":[{"delta":{"content":"سلام"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":" دنیا"}}]}',
      "",
      "data: [DONE]",
      ""
    ].join("\n");
    mockFetch(
      () =>
        new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        })
    );
    let out = "";
    for await (const chunk of adapter.stream(cfg, [{ role: "user", content: "hi" }])) {
      out += chunk;
    }
    globalThis.fetch = realFetch;
    assert.equal(out, "سلام دنیا");
  });

  test("استریم NDJSON اُلاما درست پارس می‌شود", async () => {
    const adapter = getAdapter("ollama");
    const cfg = adapter.resolve({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2:3b",
      apiKey: ""
    });
    const ndjson = [
      '{"message":{"role":"assistant","content":"سلام"},"done":false}',
      '{"message":{"role":"assistant","content":"!"},"done":false}',
      '{"message":{"role":"assistant","content":""},"done":true}',
      ""
    ].join("\n");
    mockFetch(() => new Response(ndjson, { status: 200 }));
    let out = "";
    for await (const chunk of adapter.stream(cfg, [{ role: "user", content: "hi" }])) {
      out += chunk;
    }
    globalThis.fetch = realFetch;
    assert.equal(out, "سلام!");
  });
});