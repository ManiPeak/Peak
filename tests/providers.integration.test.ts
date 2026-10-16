/**
 * تست‌های یکپارچهٔ آداپتورها — روی سوکت واقعی HTTP ولی با «سرور ساختگی محلی»
 *
 * ✅ واقعی:   قالب درخواست، هدرها، مسیرها، پاسخ‌دهی و پارس استریم
 * ❌ شبیه‌سازی‌شده: خودِ سرویس Ollama/OpenRouter (این‌ها سرور واقعی نیستند)
 *
 * برای تست واقعی با سرویس‌های اصلی، تست‌های زنده را ببینید:
 *   PEAK_RUN_LIVE_TESTS=1 npm run test:live
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { startMockProvider, type MockProvider } from "./helpers/mock-provider";
import { getAdapter, resolveConfig } from "@/lib/providers";
import { ProviderNetworkError } from "@/lib/providers/http";

async function collect(iter: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of iter) out += chunk;
  return out;
}

describe("آداپتور Ollama — یکپارچه با سرور ساختگی محلی", () => {
  let mock: MockProvider;

  before(async () => {
    mock = await startMockProvider({ models: ["llama3.2:3b", "qwen2.5:7b"], reply: "سلام از ماک" });
  });
  after(async () => {
    await mock.close();
  });

  test("فهرست مدل‌ها از /api/tags بومی خوانده می‌شود", async () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: ""
    });
    const models = await getAdapter("ollama").listModels(cfg);
    assert.deepEqual(models, ["llama3.2:3b", "qwen2.5:7b"]);
    assert.ok(mock.requests.some((r) => r.url === "/api/tags"));
  });

  test("استفاده از /v1/models به‌عنوان پسوند OpenAI هیچ‌وقت اولین تلاش نیست", async () => {
    mock.requests.length = 0;
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "llama3.2:3b",
      apiKey: ""
    });
    assert.equal(cfg.baseUrl, mock.baseUrl); // پسوند v1 حذف می‌شود
    await getAdapter("ollama").listModels(cfg);
    assert.equal(mock.requests[0].url, "/api/tags");
  });

  test("تولید متن (غیر استریمی) از /api/chat بومی", async () => {
    mock.requests.length = 0;
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: ""
    });
    const out = await getAdapter("ollama").complete(cfg, [
      { role: "user", content: "سلام" }
    ]);
    assert.equal(out.text, "سلام از ماک");
    const body = mock.lastBody() as Record<string, unknown>;
    assert.equal(body.model, "llama3.2:3b");
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [{ role: "user", content: "سلام" }]);
  });

  test("استریم NDJSON به متن کامل تبدیل می‌شود", async () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: ""
    });
    const text = await collect(getAdapter("ollama").stream(cfg, [{ role: "user", content: "hi" }]));
    assert.ok(text.includes("سلام"));
    assert.ok(text.includes("ماک"));
  });

  test("تست کامل ارائه‌دهنده: دسترسی، مدل نصب‌شده و تولید واقعی همگی PASS", async () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama3.2:3b",
      apiKey: ""
    });
    const checks = await getAdapter("ollama").check(cfg);
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    assert.equal(byId.reachability, "PASS");
    assert.equal(byId.models, "PASS");
    assert.equal(byId.model, "PASS");
    assert.equal(byId.generation, "PASS");
  });

  test("مدل نصب‌نشده با FAIL و راهنمای دقیق گزارش می‌شود", async () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: mock.baseUrl,
      model: "llama9-nonexistent",
      apiKey: ""
    });
    const checks = await getAdapter("ollama").check(cfg);
    const model = checks.find((c) => c.id === "model")!;
    assert.equal(model.status, "FAIL");
    assert.match(model.hint ?? "", /ollama pull|انتخاب کنید/);
    assert.equal(checks.find((c) => c.id === "generation"), undefined); // تست تولید انجام نشد
  });

  test("سرویس در دسترس نبودن → خطای شبکهٔ روشن", async () => {
    const cfg = resolveConfig({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:45999", // پورت بسته (شبیه‌سازی «Ollama اجرا نیست»)
      model: "llama3.2:3b",
      apiKey: ""
    });
    await assert.rejects(
      () => getAdapter("ollama").listModels(cfg),
      (err: unknown) => {
        assert.ok(err instanceof ProviderNetworkError, "باید خطای شبکه باشد");
        assert.equal(err.code, "ECONNREFUSED");
        assert.match(err.hint, /ollama serve/i);
        return true;
      }
    );
  });
});

describe("آداپتور OpenAI-سازگار (OpenRouter) — یکپارچه با سرور ساختگی محلی", () => {
  let mock: MockProvider;

  before(async () => {
    mock = await startMockProvider({
      models: ["openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct:free"],
      reply: "پاسخ کوتاه"
    });
  });
  after(async () => {
    await mock.close();
  });

  test("هدر احراز هویت و مسیر مطابق مستند رسمی است", async () => {
    mock.requests.length = 0;
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "openai/gpt-4o-mini",
      apiKey: "sk-or-v1-mocktest1234567"
    });
    await getAdapter("openrouter").listModels(cfg);
    const req = mock.requests.at(-1)!;
    assert.equal(req.url, "/v1/models");
    assert.equal(req.headers.authorization, "Bearer sk-or-v1-mocktest1234567");
    assert.equal(req.headers["x-openrouter-title"], "Peak");
  });

  test("درخواست چت به /chat/completions با ساختار OpenRouter می‌رود", async () => {
    mock.requests.length = 0;
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "openai/gpt-4o-mini",
      apiKey: "sk-or-v1-mocktest1234567"
    });
    await getAdapter("openrouter").complete(cfg, [{ role: "user", content: "سلام" }]);
    const req = mock.requests.at(-1)!;
    assert.equal(req.url, "/v1/chat/completions");
    const body = JSON.parse(req.body);
    assert.equal(body.model, "openai/gpt-4o-mini");
    assert.ok(Array.isArray(body.messages));
    assert.equal(body.stream, false);
  });

  test("استریم SSE درست به متن تبدیل می‌شود", async () => {
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "openai/gpt-4o-mini",
      apiKey: "k"
    });
    const text = await collect(
      getAdapter("openrouter").stream(cfg, [{ role: "user", content: "hi" }])
    );
    assert.equal(text.trim(), "پاسخ کوتاه");
  });

  test("بررسی اعتبار کلید از /key خوانده می‌شود", async () => {
    mock.requests.length = 0;
    const cfg = resolveConfig({
      provider: "openrouter",
      baseUrl: `${mock.baseUrl}/v1`,
      model: "openai/gpt-4o-mini",
      apiKey: "sk-or-v1-mocktest1234567"
    });
    const checks = await getAdapter("openrouter").check(cfg);
    const auth = checks.find((c) => c.id === "auth")!;
    assert.equal(auth.status, "PASS");
    assert.match(auth.detail, /کریdit باقی‌مانده/);
    assert.ok(
      mock.requests.some((r) => r.url === "/key" || r.url.endsWith("/v1/key")),
      "درخواست /key باید زده شود"
    );
  });

  test("کلید نامعتبر → FAIL با پیام 401", async () => {
    const bad = await startMockProvider({ failWith: { status: 401 } });
    try {
      const cfg = resolveConfig({
        provider: "openrouter",
        baseUrl: `${bad.baseUrl}/v1`,
        model: "openai/gpt-4o-mini",
        apiKey: "invalid"
      });
      const checks = await getAdapter("openrouter").check(cfg);
      const auth = checks.find((c) => c.id === "auth");
      assert.ok(auth);
      assert.equal(auth!.status, "FAIL");
      assert.match(auth!.detail, /401/);
    } finally {
      await bad.close();
    }
  });

  test("429 محدودیت نرخ به پیام روشن تبدیل می‌شود", async () => {
    const limited = await startMockProvider({
      failWith: { status: 429, body: { error: { message: "Rate limit exceeded" } } }
    });
    try {
      const cfg = resolveConfig({
        provider: "openrouter",
        baseUrl: `${limited.baseUrl}/v1`,
        model: "openai/gpt-4o-mini",
        apiKey: "k"
      });
      await assert.rejects(
        () => getAdapter("openrouter").complete(cfg, [{ role: "user", content: "hi" }]),
        (err: Error) => /429/.test(err.message) && /Rate limit/.test(err.message)
      );
    } finally {
      await limited.close();
    }
  });

  test("تایم‌اوت واقعی روی سرور کند", async () => {
    const slow = await startMockProvider({ delayMs: 300 });
    try {
      const cfg = resolveConfig({
        provider: "openrouter",
        baseUrl: `${slow.baseUrl}/v1`,
        model: "m",
        apiKey: "k"
      });
      await assert.rejects(
        () =>
          getAdapter("openrouter").complete(cfg, [{ role: "user", content: "hi" }], {
            timeoutMs: 80
          }),
        (err: unknown) => err instanceof ProviderNetworkError && err.kind === "timeout"
      );
    } finally {
      await slow.close();
    }
  });
});