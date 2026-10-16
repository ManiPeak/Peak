/**
 * پل گفت‌وگوی داخل بازی — هوش طبیعی برای ماینکرفت
 *
 * وقتی بازیکنی توی چت بازی حرف می‌زند:
 *   ۱. اول جمله‌های فارسی رایج را سریع (بدون LLM) اجرا می‌کند
 *   ۲. اگر سؤال/درخواست پیچیده بود، با مدل سریع ماینکرفت جواب کوتاه می‌دهد
 * ضد اسپم: هر بازیکن هر ۳.۵ ثانیه یک جواب می‌گیرد.
 */
import { botManager } from "@/minecraft/botManager";
import { logger } from "@/lib/logger";
import {
  buildContext,
  extractMcTokens,
  matchFastAction,
  runMcTokens,
  tryFastAction
} from "@/minecraft/actions";
import {
  isProtected,
  isToxicMessage,
  personalityPromptFragment,
  toxicReply
} from "@/minecraft/personality";
import { getBuiltInModel } from "@/lib/builtin-models";
import { streamBuiltInCompletion } from "@/lib/llm";
import { getSettings } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";

/** اکشن‌های امن که دوستان هم می‌تونن بدن (بقیه فقط مالک) */
const SAFE_FRIEND_ACTIONS = new Set([
  "come",
  "stop",
  "status",
  "coords",
  "players_online",
  "health_report",
  "dance",
  "wave",
  "spin",
  "party",
  "bow_to",
  "look_at",
  "follow",
  "say"
]);

let installed = false;
const lastReplyAt = new Map<string, number>();

const QUESTION_RE =
  /[?؟]|راهنما|چرا|چی|کی|کجا|چطور|چجوری|بگو|میشه|می‌تونی|میتونی|بیار|بزن|برو|بکش|بده|کن/;

/** نصب پل — فقط یک بار (فراخوانی امن از چند مسیر) */
export function installChatBridge(): void {
  if (installed) return;
  installed = true;
  botManager.setChatListener((username, message) => {
    // خطای پردازش پیام بازیکن نباید بی‌صدا بماند (وگرنه ربات خراب به‌نظر می‌رسد)
    void handlePlayerChat(username, message).catch((err: unknown) => {
      logger.error("minecraft.chat_bridge_failed", {
        username,
        error: err instanceof Error ? err.message : String(err)
      });
    });
  });
}

async function handlePlayerChat(
  username: string,
  message: string
): Promise<void> {
  const settings = getSettings();
  if (!settings.mcChatBridge) return;
  const text = message.trim();
  if (!text || text.length > 160) return;

  const botUser = botManager.getBot()?.username ?? null;
  const ownerName = settings.mcProtectTarget ?? settings.userName;
  const isOwner = username.trim().toLowerCase() === ownerName.trim().toLowerCase();
  const isFriend = isProtected(username, settings, botUser);

  // ضد اسپم — مالک کمتر، غریبه بیشتر
  const now = Date.now();
  const cooldown = isOwner ? 1200 : isFriend ? 2800 : 5000;
  const last = lastReplyAt.get(username) ?? 0;
  if (now - last < cooldown) return;

  /* ---- ۰. توهین/اذیت (فارسی/انگلیسی/فینگیلیش) → جواب به تناسب شخصیت ---- */
  if (!isOwner && !isFriend && isToxicMessage(text)) {
    lastReplyAt.set(username, now);
    botManager.rawChat(toxicReply(settings.mcPersonality));
    return;
  }

  const ctx = buildContext(ownerName, settings.mcIsOp);

  /* ---- ۱. مچ سریع فارسی/فینگیلیش (تأخیر تقریباً صفر) ---- */
  const hit = matchFastAction(text);
  if (hit) {
    // مالک: همه؛ دوست: فقط اکشن‌های امن؛ غریبه: هیچ
    const allowed = isOwner || (isFriend && SAFE_FRIEND_ACTIONS.has(hit.id));
    if (allowed) {
      const fast = await tryFastAction(text, ctx);
      if (fast) {
        lastReplyAt.set(username, now);
        botManager.rawChat(`✅ ${fast.reply}`);
        return;
      }
    }
  }

  /* ---- ۲. جواب هوشمند کوتاه برای سؤال/درخواست ---- */
  const mentionsBot = /ربات|بات|پیک|peak|هی|hi\b/i.test(text);
  if (!QUESTION_RE.test(text) && !mentionsBot) return;

  if (!hasPermission(settings, "aiNetwork")) return; // بدون دسترسی مدل، سکوت

  lastReplyAt.set(username, now);
  const preset = getBuiltInModel("minecraft");
  const persona = personalityPromptFragment(
    settings.mcPersonality,
    ownerName,
    settings.mcFriends
  );
  const messages = [
    {
      role: "system" as const,
      content:
        `تو ربات ماینکرفت «Peak» هستی و با ${username} (مالک: ${ownerName}) بازی می‌کنی. ` +
        `فقط یک جملهٔ کوتاه فارسی خودمانی جواب بده (حداکثر ۱۲ کلمه). ` +
        `پیام‌های فینگیلیش مثل "Salam" یا "bia" را بفهم. ` +
        `اگر درخواست اجرای کاری در بازی بود، در پایان جواب توکن اکشن بفرست مثل [[mc:tp_to_me]]. ` +
        persona
    },
    { role: "user" as const, content: text }
  ];

  let reply = "";
  try {
    for await (const chunk of streamBuiltInCompletion({
      backendModel: preset.backendModel,
      messages
    })) {
      reply += chunk;
      if (reply.length > 260) break;
    }
  } catch {
    return;
  }

  // توکن‌های اکشن را اجرا (فقط مالک می‌تونه توکن‌های حساس بده) و از متن چت پاک کن
  const { clean, actions } = extractMcTokens(reply);
  const runnable = isOwner
    ? actions
    : isFriend
      ? actions.filter((a) => SAFE_FRIEND_ACTIONS.has(a.id))
      : [];
  if (runnable.length) {
    const results = await runMcTokens(runnable, ctx);
    const done = results.find((r) => r.ok);
    if (done) botManager.rawChat(`⚡ ${done.reply}`);
  }
  const say = clean.replace(/\s+/g, " ").trim().slice(0, 180);
  if (say) botManager.rawChat(say);
}
