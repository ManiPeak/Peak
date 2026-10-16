/**
 * سرور ساختگی محلی برای تست‌های یکپارچه
 *
 * ⚠️ این یک «mock» است — یعنی ارائه‌دهندهٔ واقعی نیست.
 * هدفش این است که قالب درخواست/پاسخ را روی سوکت واقعی HTTP بررسی کنیم
 * (نه اینکه وانمود کنیم به اینترنت وصلیم).
 *
 * پیاده‌سازی هر دو شکل رایج را ارائه می‌دهد:
 *  • Ollama بومی:  GET /api/version | GET /api/tags | POST /api/chat (NDJSON stream)
 *  • OpenAI-سازگار: GET /v1/models | POST /v1/chat/completions (SSE) | GET /v1/key
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockServerOptions {
  /** مدل‌هایی که «نصب شده‌اند» (برای /api/tags و /v1/models) */
  models?: string[];
  /** اگر true باشد درخواست‌ها خطا می‌دهند (برای تست مسیرهای خطا) */
  failWith?: { status: number; body?: unknown };
  /** تأخیر قبل از اولین بایت پاسخ (برای تست timeout) */
  delayMs?: number;
  /** متن پاسخ مدل */
  reply?: string;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body: string;
}

export interface MockProvider {
  baseUrl: string;
  requests: RecordedRequest[];
  /** آخرین بدنهٔ JSON ارسالی به /api/chat یا /chat/completions */
  lastBody: () => Record<string, unknown> | null;
  close: () => Promise<void>;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

export async function startMockProvider(
  opts: MockServerOptions = {}
): Promise<MockProvider> {
  const models = opts.models ?? ["llama3.2:3b", "qwen2.5:7b"];
  const reply = opts.reply ?? "سلام! من ماک هستم.";
  const requests: RecordedRequest[] = [];

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const body = await readBody(req);
    requests.push({
      method: req.method ?? "GET",
      url,
      headers: req.headers as Record<string, string | undefined>,
      body
    });

    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));

    if (opts.failWith) {
      res.writeHead(opts.failWith.status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          opts.failWith.body ?? {
            error: { message: "mock failure", code: opts.failWith.status }
          }
        )
      );
      return;
    }

    // ---------- Ollama بومی ----------
    if (url === "/api/version") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version: "0.0.0-mock" }));
      return;
    }
    if (url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          models: models.map((name) => ({
            name,
            model: name,
            size: 3_000_000_000,
            details: { parameter_size: "3B", family: "llama" }
          }))
        })
      );
      return;
    }
    if (url === "/api/chat" && req.method === "POST") {
      let parsed: { stream?: boolean } = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        parsed = {};
      }
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      if (parsed.stream === false) {
        res.end(JSON.stringify({ model: "mock", message: { role: "assistant", content: reply }, done: true }));
        return;
      }
      // استریم NDJSON
      for (const part of reply.split(" ")) {
        res.write(JSON.stringify({ model: "mock", message: { role: "assistant", content: `${part} ` }, done: false }) + "\n");
      }
      res.write(JSON.stringify({ model: "mock", message: { role: "assistant", content: "" }, done: true }) + "\n");
      res.end();
      return;
    }

    // ---------- OpenAI-سازگار ----------
    if (url === "/v1/models" || url === "/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: models.map((id) => ({ id })) }));
      return;
    }
    if (url === "/key" || url === "/v1/key" || url === "/api/v1/key") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            label: "mock-key",
            limit_remaining: 12.5,
            usage: 1.25,
            is_free_tier: false,
            free_model_daily_requests: { used: 1, limit: 50, remaining: 49 }
          }
        })
      );
      return;
    }
    if ((url === "/chat/completions" || url === "/v1/chat/completions") && req.method === "POST") {
      let parsed: { stream?: boolean; model?: string } = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        parsed = {};
      }
      if (parsed.stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache"
        });
        for (const part of reply.split(" ")) {
          res.write(
            `data: ${JSON.stringify({
              id: "mock",
              model: parsed.model ?? "mock",
              choices: [{ delta: { content: `${part} ` } }]
            })}\n\n`
          );
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "mock",
          model: parsed.model ?? "mock",
          choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }]
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    lastBody() {
      for (let i = requests.length - 1; i >= 0; i--) {
        const r = requests[i];
        if (r.method === "POST" && r.body) {
          try {
            return JSON.parse(r.body) as Record<string, unknown>;
          } catch {
            return null;
          }
        }
      }
      return null;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      })
  };
}