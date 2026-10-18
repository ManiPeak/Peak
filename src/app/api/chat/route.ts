/**
 * API چت — قلب تپندهٔ «دستیار»
 * ترتیب کار: رهگیری حافظه ← رهگیری دستور ماینکرفت ← LLM (یا مغز آفلاین)
 * پاسخ به صورت استریم متنی برمی‌گردد
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import { getBuiltInModel } from "@/lib/ai-core";
import { describeError, logger } from "@/lib/logger";
import { getAdapter, resolveConfig } from "@/lib/providers";
import {
  applyForget,
  containsSensitiveData,
  extractAutoMemories,
  matchExplicitForget,
  matchExplicitRemember,
  rememberExplicit
} from "@/lib/memory";
import { buildChatHistory, buildSystemPrompt, isMinecraftTopic } from "@/lib/prompt";
import { isProviderReady, localFastReply, offlineReply } from "@/lib/offline-brain";
import { extractThought, thoughtsFromHistory } from "@/lib/pure-utils";
import type { ChatMessage } from "@/lib/llm";
import {
  appendMessage,
  autoTitleConversation,
  createConversation,
  getConversation,
  getSettings,
  listMessages,
  recentMemories
} from "@/lib/store";
import type { AppSettings, MessageMeta, ReplyMode } from "@/lib/types";
import { hasPermission } from "@/lib/permissions";
import { buildContext, extractMcTokens, runMcTokens, tryFastAction } from "@/minecraft/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سقف طول پیام کاربر (نویسه) — از کرش دیتابیس/مدل جلوگیری می‌کند */
const MAX_CONTENT_LENGTH = 8000;

/** ساخت پاسخ استریم متنی با هدرهای گفتگو
 *  • `providerError` فقط وقتی ست می‌شود که ارائه‌دهنده واقعاً خطا داده
 *  • `offlineReason` دلیل «پاسخ محلی» را شفاف می‌کند (پاسخ محلی خطای ارائه‌دهنده نیست) */
function textStream(
  text: string,
  conversationId: number,
  mode: ReplyMode,
  opts: { providerError?: string; offlineReason?: string } = {}
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": String(conversationId),
      "X-Reply-Mode": mode,
      ...(opts.providerError ? { "X-Provider-Error": "1" } : {}),
      ...(mode === "offline" && !opts.providerError && opts.offlineReason
        ? { "X-Offline-Reason": opts.offlineReason }
        : {})
    }
  });
}

export async function POST(req: NextRequest) {
  // دروازهٔ ورودی: اعتبارسنجی دقیق بدنه — قبلاً ورودی غیررشته‌ای باعث HTTP 500 می‌شد
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "بدنهٔ درخواست باید JSON معتبر باشد.", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "بدنهٔ درخواست باید یک شیء JSON باشد.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const raw = body as { conversationId?: unknown; content?: unknown };
  if (typeof raw.content !== "string") {
    logger.warn("chat.invalid_content", { type: typeof raw.content });
    return NextResponse.json(
      { error: "فیلد «content» باید رشته باشد.", code: "INVALID_CONTENT" },
      { status: 400 }
    );
  }
  const content = raw.content.trim();
  if (!content) {
    return NextResponse.json(
      { error: "متن پیام خالی است.", code: "EMPTY_CONTENT" },
      { status: 400 }
    );
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      {
        error: `پیام خیلی بلند است (حداکثر ${MAX_CONTENT_LENGTH} نویسه).`,
        code: "CONTENT_TOO_LONG"
      },
      { status: 413 }
    );
  }

  let conversationId: number | null = null;
  if (typeof raw.conversationId === "number" && Number.isFinite(raw.conversationId)) {
    conversationId = Math.trunc(raw.conversationId);
  }

  try {
    return await handleChat({ content, conversationId });
  } catch (err) {
    // هیچ استثنایی بی‌صدا نمی‌ماند و هیچ رازی به کلاینت نشت نمی‌کند
    const d = describeError(err);
    logger.error("chat.unhandled", { error: d.message, name: d.name, stack: err instanceof Error ? err.stack : undefined });
    return NextResponse.json(
      {
        error:
          "خطای داخلی در پردازش پیام. جزئیات در لاگ سرور ثبت شد.",
        code: "INTERNAL_ERROR"
      },
      { status: 500 }
    );
  }
}

/** بدنهٔ داخلی پردازش چت — از اعتبارسنجی و مدیریت خطا جدا شده است */
async function handleChat(input: {
  content: string;
  conversationId: number | null;
}): Promise<Response> {
  const content = input.content;
  const settings = getSettings();

  /* ---------------- گفتگو ---------------- */
  let conversationId = input.conversationId;
  if (conversationId != null && !getConversation(conversationId)) {
    conversationId = null;
  }
  if (conversationId == null) {
    conversationId = createConversation().id;
  }
  const convId = conversationId;

  /* ---------------- قانون ۱ و ۲ حافظه: رهگیری قبل از LLM ---------------- */
  const rememberText = matchExplicitRemember(content);
  if (rememberText) {
    let reply: string;
    const meta: MessageMeta = { mode: "memory", memories: [] };
    if (!hasPermission(settings, "memoryWrite")) {
      reply =
        "🔒 دسترسی «نوشتن در حافظه» بسته است. اگر می‌خواهی یاد بگیرم، از بخش دسترسی‌ها بازش کن.";
    } else if (containsSensitiveData(rememberText)) {
      reply =
        "⛔ این اطلاعات حساسه (رمز، توکن یا کلید API) و برای امنیتت توی حافظه ذخیره نمی‌کنم.";
      meta.blocked = true;
    } else {
      const mem = rememberExplicit(rememberText);
      meta.memories = [mem.title];
      reply = `✅ یاد گرفتم: «${mem.content}» — توی حافظه ذخیره شد.`;
    }
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, meta);
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "memory", { offlineReason: "memory" });
  }

  const forgetKeyword = matchExplicitForget(content);
  if (forgetKeyword) {
    if (!hasPermission(settings, "memoryWrite")) {
      const reply =
        "🔒 دسترسی «نوشتن در حافظه» بسته است؛ نمی‌توانم چیزی را پاک کنم.";
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", reply, { mode: "memory" });
      return textStream(reply, convId, "memory", { offlineReason: "memory" });
    }
    const count = applyForget(forgetKeyword);
    const reply =
      count > 0
        ? `🗑️ باشه، ${count} مورد مرتبط با «${forgetKeyword}» رو از حافظه پاک کردم.`
        : `چیزی مرتبط با «${forgetKeyword}» توی حافظه پیدا نکردم.`;
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, { mode: "memory" });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "memory", { offlineReason: "memory" });
  }

  /* ---------------- رهگیری دستورهای ماینکرفت (محلی و سریع) ---------------- */
  const mcResult = await botManager.runCommand(content, (perm) =>
    hasPermission(
      settings,
      perm === "control"
        ? "minecraftControl"
        : perm === "guard"
          ? "minecraftGuard"
          : "minecraftAutoAttack"
    )
  );
  if (mcResult.command !== "none") {
    const reply = mcResult.reply || "دستور اجرا شد.";
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, {
      mode: "minecraft",
      ok: mcResult.ok,
      command: mcResult.command
    });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "minecraft", { offlineReason: "minecraft-command" });
  }

  /* ---------------- مچ سریع فارسی/فینگیلیش — تأخیر تقریباً صفر ---------------- */
  {
    const fast = await tryFastAction(content, buildContext(settings.mcProtectTarget ?? settings.userName, settings.mcIsOp));
    if (fast) {
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", fast.reply, {
        mode: "minecraft",
        ok: fast.ok,
        command: "fast"
      });
      autoTitleConversation(convId, content);
      return textStream(fast.reply, convId, "minecraft", { offlineReason: "minecraft-fast" });
    }
  }

  /* ---------------- پاسخ فوری محلی (ساعت/تاریخ/حافظه/راهنما) — بدون مدل ---------------- */
  {
    const mems = hasPermission(settings, "memoryRead") ? recentMemories(40) : [];
    const fastLocal = localFastReply(content, { settings, memories: mems });
    if (fastLocal) {
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", fastLocal, { mode: "offline" });
      autoTitleConversation(convId, content);
      return textStream(fastLocal, convId, "offline", { offlineReason: "local-skill" });
    }
  }

  /* ---------------- مودهای کاربر (data/mods) — هسته دست‌نخورده ---------------- */
  {
    const { matchModCommand, fillModTemplate } = await import("@/lib/mods");
    const hit = matchModCommand(content);
    if (hit) {
      const { command } = hit;
      let reply = command.reply?.trim() || "";
      if (command.op) {
        const snap = botManager.getSnapshot();
        const filled = fillModTemplate(
          command.op,
          settings.mcProtectTarget ?? settings.userName ?? "player",
          snap.username ?? "player"
        );
        botManager.opCommand(filled);
        reply = reply || `⚡ «${command.label}» اجرا شد (مود: ${hit.mod.name}).`;
      }
      if (command.capability) {
        const { executeCapability } = await import("@/minecraft/actions");
        const r = await executeCapability(
          command.capability,
          {},
          buildContext(settings.mcProtectTarget ?? settings.userName, settings.mcIsOp)
        );
        reply = reply || r.reply || `⚡ «${command.label}» اجرا شد (مود: ${hit.mod.name}).`;
      }
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", reply, { mode: "offline", mod: hit.mod.id });
      autoTitleConversation(convId, content);
      return textStream(reply, convId, "offline", { offlineReason: "mod" });
    }
  }

  /* ---------------- تست API هوش مصنوعی — فرمان صوتی/متنی ---------------- */
  {
    const { fastProbeReply } = await import("@/lib/ai-core");
    const probeReply = await fastProbeReply(content, {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model
    });
    if (probeReply) {
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", probeReply, { mode: "offline" });
      autoTitleConversation(convId, content);
      return textStream(probeReply, convId, "offline", { offlineReason: "ai-probe" });
    }
  }

  /* ---------------- دستور ماینکرفتی بدون الگو + آفلاین = گیت فوری (تأخیر صفر به‌جای ۳۰ ثانیه مدل) ---------------- */
  if (
    !botManager.getSnapshot().connected &&
    isMinecraftTopic(content) &&
    /(بساز|بکش|بده|بیار|ببر|بذار|بریز|برگرد|وایسا|بشین|بزن|اسکن|بکن|روشن|خاموش|مرتب|جمع|برو|بیا|بریم|بیایم)(?:ید|یم|ین|ن|ش)?[^آ-ی]{0,3}$/.test(
      content
    )
  ) {
    const reply = "فعلاً به سروری وصل نیستم. اول وصلم کن!";
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, {
      mode: "minecraft",
      command: "offline-gate"
    });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "minecraft", { offlineReason: "minecraft-offline-gate" });
  }

  /* ---------------- قانون ۳ حافظه: استخراج خودکار ---------------- */
  const autoMems =
    settings.autoMemory && hasPermission(settings, "memoryExtract")
      ? extractAutoMemories(content)
      : [];
  const meta: MessageMeta = {
    mode: "llm",
    memories: autoMems.map((m) => m.title)
  };

  /* ---------------- آماده‌سازی تاریخچه ---------------- */
  const history = listMessages(convId).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content
  }));
  appendMessage(convId, "user", content);
  autoTitleConversation(convId, content);

  const memories = hasPermission(settings, "memoryRead")
    ? recentMemories(40)
    : [];
  // مدل‌های داخلی، شخصیت تخصصی خودشان را دارند
  const persona =
    settings.provider === "builtin"
      ? getBuiltInModel(settings.model).persona
      : undefined;
  const systemPrompt = buildSystemPrompt(settings, memories, persona,
    thoughtsFromHistory(history.filter((h) => h.role === "assistant").map((h) => h.content)),
    isMinecraftTopic(content, history.map((h) => h.content)));
  const llmMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...buildChatHistory(history.concat([{ role: "user" as const, content }]))
  ];

  /* ---------------- حالت آفلاین (یا قطع دسترسی اینترنتی مدل) ---------------- */
  if (!hasPermission(settings, "aiNetwork") || !isProviderReady(settings)) {
    const reply = offlineReply(content, { settings, memories });
    appendMessage(convId, "assistant", reply, {
      mode: "offline",
      blocked: !hasPermission(settings, "aiNetwork") || undefined
    });
    return textStream(reply, convId, "offline", {
      offlineReason: hasPermission(settings, "aiNetwork")
        ? "provider-not-ready"
        : "permission-blocked"
    });
  }

  /* ---------------- استریم از ارائه‌دهنده با سقوط امن به آفلاین ---------------- */
  const encoder = new TextEncoder();
  const providerCfg = resolveConfig(settings);
  const adapter = getAdapter(settings.provider);

  logger.info("chat.request", {
    conversationId: convId,
    provider: providerCfg.provider,
    baseUrl: providerCfg.baseUrl,
    model: providerCfg.model,
    apiKeySource: providerCfg.sources.apiKey
  });

  // «پیش‌گرم» استریم: اولین تکه را قبل از ارسال هدرها می‌خوانیم تا
  // X-Reply-Mode و X-Provider واقعاً همان چیزی باشند که اتفاق می‌افتد.
  const generator = adapter.stream(providerCfg, llmMessages);
  let primed: string | null = null;
  let primeError: string | null = null;
  try {
    const first = await generator.next();
    if (!first.done) primed = first.value;
  } catch (err) {
    primeError = describeError(err).message;
    logger.warn("chat.provider_failed_before_stream", {
      provider: providerCfg.provider,
      baseUrl: providerCfg.baseUrl,
      model: providerCfg.model,
      error: primeError
    });
  }

  let fullText = "";
  let failed: string | null = null;
  let mode: ReplyMode = "llm";
  let fallbackText: string | null = null;

  if (primeError) {
    // ارائه‌دهنده پاسخ نداد — به مغز آفلاین سقوط می‌کنیم ولی دلیل را پنهان نمی‌کنیم
    failed = primeError;
    mode = "offline";
    meta.mode = "offline";
    meta.error = primeError;
    fallbackText = `${providerFailureNotice(primeError, settings)}\n\n${offlineReply(
      content,
      { settings, memories }
    )}`;
    fullText = fallbackText;
  } else {
    meta.mode = "llm";
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (fallbackText !== null) {
          // پاسخ جایگزین آماده است — همان را به کلاینت می‌فرستیم
          controller.enqueue(encoder.encode(fallbackText));
        } else {
          if (primed !== null) {
            fullText += primed;
            controller.enqueue(encoder.encode(primed));
          }
          for await (const chunk of generator) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } catch (err) {
        // سقوط به مغز آفلاین — دلیل خطا به کاربر و لاگ می‌رود
        failed = describeError(err).message;
        mode = "offline";
        meta.error = failed;
        meta.mode = "offline";
        logger.warn("chat.provider_stream_failed", {
          provider: providerCfg.provider,
          model: providerCfg.model,
          error: failed
        });
        const fallback = `${providerFailureNotice(failed, settings)}\n\n${offlineReply(
          content,
          { settings, memories }
        )}`;
        fullText += fallback;
        controller.enqueue(encoder.encode(fallback));
      } finally {
        // اجرای توکن‌های اکشن ماینکرفت (هوش طبیعی — «[[mc:id|args]]»)
        let saveText = fullText;
        try {
          const { clean, actions } = extractMcTokens(fullText);
          if (actions.length) {
            saveText = clean || fullText;
            const ctx = buildContext(
              settings.mcProtectTarget ?? settings.userName,
              settings.mcIsOp
            );
            const results = await runMcTokens(actions, ctx);
            meta.mcActions = results.map((r) => ({
              id: r.id,
              ok: r.ok,
              reply: r.reply
            }));
          }
        } catch (err) {
          logger.warn("chat.mc_token_failed", {
            error: describeError(err).message
          });
        }
        // ذهن: فکر خط اول 💡 در متادیتا می‌رود؛ متن کامل (همراه فکر) در تاریخچه می‌ماند
        const { thought } = extractThought(fullText);
        if (thought) meta.thought = thought;
        try {
          appendMessage(convId, "assistant", saveText, meta);
        } catch (err) {
          logger.error("chat.persist_failed", { error: describeError(err).message });
        }
        logger.info("chat.reply", {
          conversationId: convId,
          mode,
          failed: failed ?? undefined,
          length: saveText.length
        });
        try {
          controller.close();
        } catch {
          /* کلاینت رفته */
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": String(convId),
      // حالا این هدر واقعی است، نه حدس قبل از اجرا
      "X-Reply-Mode": mode,
      "X-Provider": providerCfg.provider,
      "X-Model": providerCfg.model,
      ...(failed ? { "X-Provider-Error": "1" } : {})
    }
  });
}

/** پیام کوتاه و صادقانه برای وقتی ارائه‌دهنده جواب نمی‌دهد */
function providerFailureNotice(error: string, settings: AppSettings): string {
  const provider = settings.provider;
  const hints: Record<string, string> = {
    ollama: "بررسی کن Ollama در حال اجرا باشد و مدل نصب باشد: `ollama list`",
    openrouter: "کلید OPENROUTER_API_KEY و نام دقیق مدل را بررسی کن.",
    builtin: "سرویس داخلی رایگان در دسترس نیست (اینترنت یا خود سرویس).",
    "9router": "بررسی کن 9Router روی همان پورت بالا آمده باشد."
  };
  return `⚠️ ارائه‌دهندهٔ «${provider}» پاسخ نداد — برای همین به حالت آفلاین برگشتم.\nجزئیات: ${error}\n${
    hints[provider] ?? "در صفحهٔ تنظیمات، «تست اتصال» را بزنید."
  }`;
}
