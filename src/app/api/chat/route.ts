/**
 * API چت — قلب تپندهٔ «دستیار»
 * ترتیب کار: رهگیری حافظه ← رهگیری دستور ماینکرفت ← LLM (یا مغز آفلاین)
 * پاسخ به صورت استریم متنی برمی‌گردد
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import { getBuiltInModel } from "@/lib/builtin-models";
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
import { extractThought, thoughtsFromHistory } from "@/lib/mind";
import {
  streamBuiltInCompletion,
  streamChatCompletion,
  type ChatMessage
} from "@/lib/llm";
import {
  appendMessage,
  autoTitleConversation,
  createConversation,
  getConversation,
  getSettings,
  listMessages,
  recentMemories
} from "@/lib/store";
import type { MessageMeta, ReplyMode } from "@/lib/types";
import { hasPermission } from "@/lib/permissions";
import { buildContext, extractMcTokens, runMcTokens, tryFastAction } from "@/minecraft/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ساخت پاسخ استریم متنی با هدرهای گفتگو */
function textStream(
  text: string,
  conversationId: number,
  mode: ReplyMode
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
      "X-Reply-Mode": mode
    }
  });
}

export async function POST(req: NextRequest) {
  let body: { conversationId?: number; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "بدنهٔ درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "متن پیام خالی است." }, { status: 400 });
  }

  const settings = getSettings();

  /* ---------------- گفتگو ---------------- */
  let conversationId = body.conversationId ?? null;
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
    return textStream(reply, convId, "memory");
  }

  const forgetKeyword = matchExplicitForget(content);
  if (forgetKeyword) {
    if (!hasPermission(settings, "memoryWrite")) {
      const reply =
        "🔒 دسترسی «نوشتن در حافظه» بسته است؛ نمی‌توانم چیزی را پاک کنم.";
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", reply, { mode: "memory" });
      return textStream(reply, convId, "memory");
    }
    const count = applyForget(forgetKeyword);
    const reply =
      count > 0
        ? `🗑️ باشه، ${count} مورد مرتبط با «${forgetKeyword}» رو از حافظه پاک کردم.`
        : `چیزی مرتبط با «${forgetKeyword}» توی حافظه پیدا نکردم.`;
    appendMessage(convId, "user", content);
    appendMessage(convId, "assistant", reply, { mode: "memory" });
    autoTitleConversation(convId, content);
    return textStream(reply, convId, "memory");
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
    return textStream(reply, convId, "minecraft");
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
      return textStream(fast.reply, convId, "minecraft");
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
      return textStream(fastLocal, convId, "offline");
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
      return textStream(reply, convId, "offline");
    }
  }

  /* ---------------- تست API هوش مصنوعی — فرمان صوتی/متنی ---------------- */
  {
    const { fastProbeReply } = await import("@/lib/aiProbe");
    const probeReply = await fastProbeReply(content, {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model
    });
    if (probeReply) {
      appendMessage(convId, "user", content);
      appendMessage(convId, "assistant", probeReply, { mode: "offline" });
      autoTitleConversation(convId, content);
      return textStream(probeReply, convId, "offline");
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
    return textStream(reply, convId, "minecraft");
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
    return textStream(reply, convId, "offline");
  }

  /* ---------------- استریم از ارائه‌دهنده با سقوط امن به آفلاین ---------------- */
  const encoder = new TextEncoder();
  let fullText = "";
  let failed: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (settings.provider === "builtin") {
          // مدل داخلی رایگان — بدون کلید API
          const preset = getBuiltInModel(settings.model);
          for await (const chunk of streamBuiltInCompletion({
            backendModel: preset.backendModel,
            messages: llmMessages
          })) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } else {
          for await (const chunk of streamChatCompletion({
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            model: settings.model,
            messages: llmMessages
          })) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        meta.mode = "llm";
      } catch (err) {
        // سقوط به مغز آفلاین — بدون خطای قرمز برای کاربر
        failed = err instanceof Error ? err.message : "خطای ناشناخته";
        meta.error = failed;
        meta.mode = "offline";
        const fallback = offlineReply(content, { settings, memories });
        fullText = fallback;
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
        } catch {
          /* نادیده */
        }
        // ذهن: فکر خط اول 💡 در متادیتا می‌رود؛ متن کامل (همراه فکر) در تاریخچه می‌ماند
        const { thought } = extractThought(fullText);
        if (thought) meta.thought = thought;
        appendMessage(convId, "assistant", saveText, meta);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": String(convId),
      "X-Reply-Mode": meta.mode
    }
  });
}
