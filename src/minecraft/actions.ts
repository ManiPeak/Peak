/**
 * موتور اکشن‌های طبیعی ماینکرفت
 *
 * سه مسیر اجرا (به ترتیب سرعت):
 *   ۱. جمله‌های فارسی رایج → اکشن مستقیم (بدون LLM — تأخیر تقریباً صفر)
 *   ۲. توکن‌های «[[mc:id|args]]» که هوش مصنوعی در جوابش می‌فرستد
 *   ۳. دستورهای داخلی runCommand (حرکت‌ها)
 */
import { botManager } from "@/minecraft/botManager";
import {
  findCapability,
  type Capability
} from "@/minecraft/capabilities";
import type { CommandResult } from "@/minecraft/core";
import { AUTH_PASSWORD, isProtected, normalizeFinglish } from "@/minecraft/core";
import { getSettings, saveSettings } from "@/lib/store";
import { toEnglishDigits, toPersianDigits } from "@/lib/pure-utils";

/** نتیجهٔ اجرای یک توانایی */
export interface ActionResult {
  ok: boolean;
  id: string;
  reply: string;
}

interface ExecContext {
  /** بازیکن هدف (معمولاً ManiPeak) */
  player: string | null;
  /** آیا اکانت OP است؟ */
  isOp: boolean;
}

/* ------------------------------------------------------------------ */
/* اجرای تکی توانایی                                                    */
/* ------------------------------------------------------------------ */

export async function executeCapability(
  id: string,
  args: Record<string, string>,
  ctx: ExecContext
): Promise<ActionResult> {
  const cap = findCapability(id);
  if (!cap) return { ok: false, id, reply: "چنین کاری رو نمی‌شناسم." };

  // گیت OP
  if (cap.op && !ctx.isOp) {
    return {
      ok: false,
      id,
      reply: `برای «${cap.label}» باید اکانتم OP باشه. توی فرم سرور تیک OP رو بزن.`
    };
  }

  // گیت سطح بازی — مثل مهروموم خدایی/نبرد خدایی که فقط در سطح «خدا» در دسترس‌اند
  if (cap.level && getSettings().mcPlayLevel !== cap.level) {
    return {
      ok: false,
      id,
      reply: `🔒 «${cap.label}» فقط در سطح بازی «خدا» در دسترس است — در صفحهٔ ماینکرفت، «سطح بازی» را روی 👑 خدا بگذار.`
    };
  }

  // گیت اتصال — به‌جز توانایی‌های تنظیماتی که بدون سرور هم کار می‌کنند
  const OFFLINE_CAPS = new Set([
    "personality_angry",
    "personality_kind",
    "personality_normal",
    "speed_tp_on",
    "speed_tp_off",
    "friend_add",
    "friend_remove",
    "server_register",
    "server_login",
    "kill_squad",
    "scan_radius"
  ]);
  const snap = botManager.getSnapshot();
  if (!snap.connected && cap.kind !== "info" && !OFFLINE_CAPS.has(id)) {
    return {
      ok: false,
      id,
      reply: "فعلاً به سروری وصل نیستم. اول وصلم کن!"
    };
  }

  const player = args.player ?? ctx.player ?? snap.username ?? "@s";
  const self = snap.username ?? "@s";

  try {
    /* ---------- دستورهای OP (الگوی اسلش) ---------- */
    if (cap.kind === "op" && cap.template) {
      // پر کردن مختصات نسبی از جای فعلی ربات — با پشتیبانی آفست مثل {x+6} یا {y-2}
      const pos = snap.pos ?? { x: 0, y: 64, z: 0 };
      const yUp = pos.y + 80;
      const baseC = {
        x: Number(args.x ?? pos.x),
        y: Number(args.y ?? pos.y),
        z: Number(args.z ?? pos.z)
      };
      const cmd = cap.template
        .replace(/\{([xyz])([+-]\d+)?\}/g, (_mm, axis: "x" | "y" | "z", off?: string) =>
          String(baseC[axis] + (off ? parseInt(off, 10) : 0))
        )
        .replaceAll("{self}", self)
        .replaceAll("{player}", player)
        .replaceAll("{item}", args.item ?? args.text ?? "stone")
        .replaceAll("{mob}", args.mob ?? args.item ?? "zombie")
        .replaceAll("{effect}", args.effect ?? args.item ?? "speed")
        .replaceAll("{text}", args.text ?? args.item ?? "...")
        .replaceAll("{n}", args.n ?? "1")
        .replaceAll("{x}", args.x ?? String(pos.x))
        .replaceAll("{y}", args.y ?? String(pos.y))
        .replaceAll("{z}", args.z ?? String(pos.z));
      // تلپورت به بالا: y را جایگزین کن
      const finalCmd =
        id === "tp_up" || id === "hide"
          ? cmd.replace(
              /tp (\S+) (\S+) (\S+) (\S+)/,
              (_m, a, x, _y, z) => `tp ${a} ${x} ${yUp} ${z}`
            )
          : cmd;
      botManager.opCommand(finalCmd);
      return { ok: true, id, reply: `⚡ ${cap.label} — انجام شد.` };
    }

    /* ---------- اطلاعات ---------- */
    if (cap.kind === "info") {
      if (id === "danger_scan") {
        // اسکن محیط با شعاع بزرگ (۱۲۸ بلوک)
        const s = botManager.scanArea();
        const h = s.hostiles
          .slice(0, 8)
          .map((x) => `${x.name} (${x.dist}m)`)
          .join("، ");
        const p = s.players
          .slice(0, 8)
          .map((x) => `${x.name}${x.protected ? "🛡" : ""} (${x.dist}m)`)
          .join("، ");
        return {
          ok: true,
          id,
          reply:
            `🔎 اسکن ${s.radius} بلوکی:\n` +
            `🧟 خصم: ${h || "هیچی"}\n` +
            `👥 بازیکن: ${p || "کسی"}\n` +
            `🐾 حیوان: ${s.animals} | 📦 آیتم: ${s.items}\n` +
            `⚠️ خطر: ${s.hazards.join("، ") || "ندارد"}`
        };
      }
      return { ok: true, id, reply: infoReply(id, snap, botManager.getBot()) };
    }

    /* ---------- مهروموم خدایی / نبرد خدایی (پاسخ دقیق با ok درست) ---------- */
    if (id === "god_seal_on" || id === "god_seal_off" || id === "god_pvp") {
      return divineSealAction(id, args, ctx);
    }

    /* ---------- اکشن‌های داخلی API ---------- */
    return { ok: true, id, reply: await apiAction(id, args, ctx, cap) };
  } catch (e) {
    return {
      ok: false,
      id,
      reply: `اجرا نشد: ${e instanceof Error ? e.message : "خطای ناشناخته"}`
    };
  }
}

/** پاسخ‌های اطلاعاتی */
function infoReply(
  id: string,
  snap: ReturnType<typeof botManager.getSnapshot>,
  bot: ReturnType<typeof botManager.getBot> = null
): string {
  const players = snap.players.length ? snap.players.join("، ") : "کسی آنلاین نیست";
  const pos = snap.pos
    ? `X=${snap.pos.x} Y=${snap.pos.y} Z=${snap.pos.z}`
    : "نامشخص";
  switch (id) {
    case "coords":
      return `📍 مختصاتم: ${pos}`;
    case "health_report":
      return `❤️ جان: ${snap.health ?? "؟"}/20 — 🍖 سیری: ${snap.food ?? "؟"}/20`;
    case "players_online":
      return `👥 آنلاین‌ها: ${players}`;
    case "nearest_player":
      return `🎯 نزدیک‌ترین بازیکن: ${snap.players[0] ?? "کسی نیست"}`;
    case "dimension_info":
      return `🌌 بعد: ${snap.dimension ?? "نامشخص"}`;
    case "server_info":
      return `🖥️ سرور: ${snap.connected ? "متصل" : "قطع"} — من: ${snap.username ?? "؟"}`;
    case "status":
      return `📊 وضعیت: ${snap.connected ? "متصل" : "قطع"} | مختصات: ${pos} | جان: ${snap.health ?? "؟"} | بازیکنان: ${players}`;
    case "facing_direction": {
      const deg = (((bot?.entity?.yaw ?? 0) * 180) / Math.PI + 360) % 360;
      const dir = deg < 45 || deg >= 315 ? "شمال" : deg < 135 ? "شرق" : deg < 225 ? "جنوب" : "غرب";
      return `🧭 رو به ${dir} هستم`;
    }
    case "ping_report": {
      const ping = bot && bot.username ? bot.players[bot.username]?.ping : undefined;
      return `📡 پینگ: ${ping ?? "؟"} میلی‌ثانیه`;
    }
    case "held_item":
      return `🖐️ آیتم دستم: ${bot?.heldItem?.displayName ?? bot?.heldItem?.name ?? "هیچی"}`;
    case "mob_count": {
      const n = Object.values(bot?.entities ?? {}).filter((e) => e.kind === "Hostile").length;
      return `🧟 ماب خصم اطراف: ${toPersianDigits(String(n))} تا`;
    }
    case "nearby_entities": {
      const names = Object.values(bot?.entities ?? {})
        .filter((e) => e !== bot?.entity)
        .slice(0, 10)
        .map((e) => e.name)
        .join("، ");
      return `🐾 موجودات اطراف: ${names || "کسی نیست"}`;
    }
    case "speed_report": {
      const v = bot?.entity?.velocity;
      const s = v ? Math.round(Math.hypot(v.x, v.z) * 100) / 100 : 0;
      return `💨 سرعت فعلی: ${toPersianDigits(String(s))} بلوک/ثانیه`;
    }
    case "armor_status": {
      const eq = (bot?.entity?.equipment ?? []).map((e) => e?.displayName ?? "—");
      return `🛡️ زره: ${eq.slice(1).join("، ") || "هیچی نپوشیدم"}`;
    }
    case "block_at_feet": {
      const b = bot?.entity ? bot.blockAt(bot.entity.position.offset(0, -1, 0)) : null;
      return `🧱 زیر پام: ${b?.name ?? "نامشخص"}`;
    }
    case "world_ticks": {
      if (!bot) return "⏳ بدون اتصال به سرور، زمان بازی را نمی‌دانم.";
      const t = bot.time?.timeOfDay ?? 0;
      const day = t < 12500;
      return `🕐 تیک بازی: ${toPersianDigits(String(Math.floor(t)))} — الان ${day ? "روز" : "شب"} است`;
    }
    default:
      return "🔎 همه‌چیز عادیه.";
  }
}

/* ------------------------------------------------------------------ */
/* مهروموم خدایی (Divine Seal) — زیرمجموعهٔ حالت خدا + نبرد خدایی        */
/* ساختار: ربات ← سطح خدا ← توانایی‌های خدا ← مهروموم خدایی             */
/* ------------------------------------------------------------------ */

/** بازیکنان مهروموم‌شده (همگام با تگ peak_sealed روی سرور) */
const sealedPlayers = new Set<string>();

/** فهرست بازیکنان مهروموم‌شده — برای تست و نمایش وضعیت */
export function getSealedPlayers(): string[] {
  return [...sealedPlayers];
}

/** برد مهروموم (بلوک) — دورتر از این باید نزدیک شد/تلپورت کرد */
const SEAL_RANGE = 24;
/** حداقل جان برای اجرای مهروموم (بررسی منابع/پیش‌نیاز اجرا) */
const SEAL_MIN_HEALTH = 6;

/** نام نمایشی موجودیت هدف */
function entityName(e: { username?: string | null; name?: string | null }): string {
  return (e.username ?? e.name ?? "").trim();
}

/** اجرای مهروموم روی هدف — پس از بررسی منابع و فاصله؛ با فرمان‌های واقعی سرور */
function applyDivineSeal(
  targetName: string,
  targetPos: { x: number; y: number; z: number } | null | undefined,
  snap: ReturnType<typeof botManager.getSnapshot>,
  settings: ReturnType<typeof getSettings>
): ActionResult {
  // پیش‌نیاز: منابع (جان)
  if (snap.health != null && snap.health < SEAL_MIN_HEALTH) {
    return {
      ok: false,
      id: "god_seal_on",
      reply: `💔 جانم ${snap.health} است و برای اجرای مهروموم کم است (حداقل ${SEAL_MIN_HEALTH}) — اول «شفای مطلق» بگو یا عقب‌نشینی کن.`
    };
  }
  // پیش‌نیاز: فاصله تا هدف
  const myPos = botManager.getBot()?.entity?.position;
  if (myPos && targetPos) {
    const d = Math.hypot(myPos.x - targetPos.x, myPos.y - targetPos.y, myPos.z - targetPos.z);
    if (d > SEAL_RANGE) {
      if (!settings.mcIsOp) {
        return {
          ok: false,
          id: "god_seal_on",
          reply: `📏 «${targetName}» حدود ${Math.round(d)} بلوک دور است (برد مهروموم ${SEAL_RANGE} بلوک) — نزدیک‌تر شو یا تلپورت کن.`
        };
      }
      // با OP: خودش کنار هدف می‌رود (از همان مسیر حرکت/تلپورت نبرد)
      void botManager.tpNear(targetPos);
    }
  }
  // اجرا — فرمان‌های واقعی ماینکرفت، پشت‌سرهم و بدون تأخیر اضافه
  botManager.opCommand(`tag ${targetName} add peak_sealed`);
  botManager.opCommand(`effect give ${targetName} slowness 999 255`);
  botManager.opCommand(`effect give ${targetName} weakness 999 255`);
  botManager.opCommand(`effect give ${targetName} mining_fatigue 999 255`);
  botManager.opCommand(`effect give ${targetName} glowing 999 0`);
  botManager.opCommand(`gamemode adventure ${targetName}`);
  sealedPlayers.add(targetName);
  return {
    ok: true,
    id: "god_seal_on",
    reply: `🪬 مهروموم خدایی روی «${targetName}» اجرا شد — بی‌حرکت، ناتوان و زیر نظر (۹۹۹ ثانیه). برای باز کردن: «مهروموم رو بردار».`
  };
}

/** اجرای مهروموم/نبرد خدایی — پاسخ‌های دقیق و قابل‌فهم در هر شکست */
async function divineSealAction(
  id: string,
  args: Record<string, string>,
  ctx: ExecContext
): Promise<ActionResult> {
  const bot = botManager.getBot();
  const snap = botManager.getSnapshot();
  const settings = getSettings();
  const selfName = snap.username ?? "@s";

  /* ── باز کردن/توقف مهروموم — همیشه در دسترس (حتی خارج از سطح خدا) ── */
  if (id === "god_seal_off") {
    const name = (args.player ?? "").trim();
    const all = !name || /^(همه|all)$/i.test(name);
    if (all) {
      for (const s of sealedPlayers) {
        botManager.opCommand(`tag ${s} remove peak_sealed`);
        botManager.opCommand(`effect clear ${s}`);
        botManager.opCommand(`gamemode survival ${s}`);
      }
      botManager.opCommand("effect clear @a[tag=peak_sealed]");
      botManager.opCommand("gamemode survival @a[tag=peak_sealed]");
      botManager.opCommand("tag @a[tag=peak_sealed] remove peak_sealed");
      const n = sealedPlayers.size;
      sealedPlayers.clear();
      return {
        ok: true,
        id,
        reply: `🔓 مهروموم خدایی از ${n ? `${n} بازیکن` : "همه"} برداشته شد — عملیات مهروموم متوقف است.`
      };
    }
    botManager.opCommand(`tag ${name} remove peak_sealed`);
    botManager.opCommand(`effect clear ${name}`);
    botManager.opCommand(`gamemode survival ${name}`);
    for (const s of sealedPlayers) {
      if (s.toLowerCase() === name.toLowerCase()) sealedPlayers.delete(s);
    }
    return { ok: true, id, reply: `🔓 مهروموم «${name}» برداشته شد — دوباره آزاد است.` };
  }

  /* ── انتخاب هدف با منطق موجود: نام دقیق، یا نزدیک‌ترین دشمن غیردوست ── */
  const named = (args.player ?? "").trim();
  let targetName = named;
  let target: ReturnType<typeof botManager.findPlayerStrict> = null;
  if (named) {
    target = botManager.findPlayerStrict(named);
    if (!target) {
      return { ok: false, id, reply: `🎯 بازیکن «${named}» اینجا نیست — نام درست را بگو.` };
    }
    targetName = entityName(target) || named;
  } else {
    const e = botManager.nearestEnemyPlayer() ?? botManager.nearestHostile();
    if (e) {
      target = e;
      targetName = entityName(e);
    }
  }
  if (!target || !targetName) {
    return {
      ok: false,
      id,
      reply:
        id === "god_pvp"
          ? "🎯 دشمنی برای نبرد خدایی پیدا نکردم — نام بازیکن را بگو (مثل «نبرد خدایی روی علی») یا دشمنی نزدیکم نیست."
          : "🎯 هدفی برای مهروموم پیدا نکردم — نام بازیکن را بگو (مثل «مهروموم خدایی روی علی») یا دشمنی نزدیکم نیست."
    };
  }

  /* ── محافظت دوستان: هرگز — نه مهروموم، نه نبرد ── */
  if (isProtected(targetName, settings, selfName)) {
    return {
      ok: false,
      id,
      reply: `❌ «${targetName}» جزو دوستای منه — مهروموم/نبرد خدایی روی دوست اجرا نمی‌شه! فقط غریبه‌ها.`
    };
  }

  /* ── مهروموم خدایی: بررسی پیش‌نیازها ← اجرا ── */
  if (id === "god_seal_on") {
    return applyDivineSeal(targetName, target.position, snap, settings);
  }

  /* ── نبرد خدایی (God PvP): مراحل ۵گانه ── */
  // ۳) آغاز نبرد با مکانیک‌های واقعی ماینکرفت — بدون تأخیر اضافه
  if (settings.mcIsOp && target.position) await botManager.tpNear(target.position);
  try {
    await bot?.attack(target);
  } catch (e) {
    return {
      ok: false,
      id,
      reply: `اجرا نشد: ضربهٔ اول به «${targetName}» نخورد (${e instanceof Error ? e.message : "خطای ناشناخته"})`
    };
  }
  botManager.setAutoAttackMode(true);
  // هماهنگی با امکانات سطح خدا: آماده‌سازی خودم با حالت خدا
  await executeCapability("god_mode_on", { player: selfName }, ctx);

  // ۴) شرایط مناسب ← اجرای مهروموم از همان مسیر توانایی (بدون کپی منطق)
  let seal = await executeCapability("god_seal_on", { player: targetName }, ctx);
  if (!seal.ok && /جانم/.test(seal.reply)) {
    // منابع کم بود ← شفای مطلق (توانایی سطح خدا) و فقط یک تلاش دیگر
    await executeCapability("god_heal", { player: selfName }, ctx);
    seal = await executeCapability("god_seal_on", { player: targetName }, ctx);
  }

  // ۵) تأیید نتیجه ← ادامهٔ مبارزه یا عقب‌نشینی
  if (seal.ok) {
    try {
      await bot?.attack(target);
    } catch {
      /* فشار ادامه دارد حتی اگر ضربهٔ دوم نخورد */
    }
    return {
      ok: true,
      id,
      reply: `⚔️ نبرد خدایی: «${targetName}» درگیر شد ← ${seal.reply} — ادامه می‌دهم (برای توقف: «مهروموم رو بردار» یا «وایسا»).`
    };
  }
  botManager.setAutoAttackMode(false);
  const retreat = await executeCapability("flee", {}, ctx);
  return {
    ok: false,
    id,
    reply: `⚔️ نبرد با «${targetName}» شروع شد ولی مهروموم اجرا نشد: ${seal.reply} — عقب‌نشینی کردم (${retreat.reply})`
  };
}

/** اکشن‌های داخلی — با API ربات */
async function apiAction(
  id: string,
  args: Record<string, string>,
  ctx: ExecContext,
  cap: Capability
): Promise<string> {
  const bot = botManager.getBot();
  const snap = botManager.getSnapshot();
  /** نام بازیکن هدف برای دستورها */
  const player = args.player ?? ctx.player ?? snap.username ?? "@s";
  switch (id) {
    /* حرکت */
    case "follow":
    case "come":
    case "stop":
    case "goto":
    case "jump":
    case "look_at": {
      const phrase =
        id === "follow"
          ? "بیا دنبالم"
          : id === "come"
            ? "بیا پیشم"
            : id === "stop"
              ? "وایسا"
              : id === "jump"
                ? "بپر"
                : id === "look_at"
                  ? "نگام کن"
                  : `برو به ${args.x ?? 0} ${args.y ?? 64} ${args.z ?? 0}`;
      const r: CommandResult = await botManager.runCommand(phrase);
      return r.reply || cap.label;
    }
    case "go_back": {
      const r: CommandResult = await botManager.goBack();
      return r.reply || cap.label;
    }
    case "mark_here": {
      const r: CommandResult = await botManager.markHere();
      return r.reply || cap.label;
    }
    case "sprint":
      botManager.setRocketMode(true);
      return "🚀 حالت موشکی روشن شد!";
    case "crouch":
      bot?.setControlState("sneak", true);
      setTimeout(() => bot?.setControlState("sneak", false), 2500);
      return "🧎 نشستم.";
    case "swim":
      bot?.setControlState("jump", true);
      setTimeout(() => bot?.setControlState("jump", false), 1500);
      return "🏊 در حال شنا!";
    case "back":
    case "left":
    case "right": {
      const key = id === "back" ? "back" : id === "left" ? "left" : "right";
      bot?.setControlState(key as "back", true);
      setTimeout(() => bot?.setControlState(key as "back", false), 900);
      return `حرکت به ${id === "back" ? "عقب" : id === "left" ? "چپ" : "راست"}...`;
    }
    case "jump_party":
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          bot?.setControlState("jump", true);
          setTimeout(() => bot?.setControlState("jump", false), 250);
        }, i * 550);
      }
      return "🎉 هپ! هپ! هپ!";
    case "patrol":
    case "circle": {
      const t = botManager.resolvePlayerEntity(ctx.player);
      if (!t) return "بازیکنی نیست که دورش بچرخم.";
      const { x, y, z } = t.position;
      const r = 4;
      const pts =
        id === "circle"
          ? [
              [x + r, y, z],
              [x, y, z + r],
              [x - r, y, z],
              [x, y, z - r]
            ]
          : [
              [x + r, y, z + r],
              [x - r, y, z - r]
            ];
      pts.forEach(([px, py, pz], i) => {
        setTimeout(() => {
          const g = new (
            // require عمدی: مسیریاب اختیاری است و باید همین‌جا و هم‌زمان لود شود
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("mineflayer-pathfinder") as typeof import("mineflayer-pathfinder")
          ).goals.GoalNear(px, py, pz, 1.5);
          bot?.pathfinder.setGoal(g);
        }, i * 2500);
      });
      return `🌀 ${id === "circle" ? "دورت می‌چرخم" : "در حال گشت‌زنی"}!`;
    }
    case "bridge_walk":
      bot?.setControlState("forward", true);
      setTimeout(() => bot?.setControlState("forward", false), 3000);
      return "🌉 در حال حرکت با پل!";
    case "dance":
    case "party":
    case "spin": {
      let i = 0;
      const t = setInterval(() => {
        i++;
        if (!bot || i > 12) return clearInterval(t);
        bot.setControlState("jump", id !== "spin");
        if (id === "spin") bot.look(bot.entity.yaw + Math.PI / 2, 0, false);
        setTimeout(() => bot?.setControlState("jump", false), 200);
      }, 450);
      return id === "spin" ? "🔄 می‌چرخم!" : "💃 دارم می‌رقصم!";
    }
    case "wave":
    case "bow_to":
    case "roleplay_police":
    case "roleplay_bodyguard":
      botManager.rawChat(
        id === "wave"
          ? "سلام! 👋"
          : id === "bow_to"
            ? "احترام! 🎩"
            : id === "roleplay_police"
              ? "🚨 پلیس در صحنه!"
              : "🛡️ محافظ شخصی در خدمتم."
      );
      return cap.label;
    case "sneak_spam": {
      let i = 0;
      const t = setInterval(() => {
        i++;
        if (!bot || i > 6) return clearInterval(t);
        bot.setControlState("sneak", i % 2 === 1);
      }, 400);
      return "🧎 اسنیک ریتمیک!";
    }
    case "drop_item_fun":
    case "drop_junk": {
      const junk = bot?.inventory?.items?.()?.[0];
      if (bot && junk) {
        await bot.tossStack(junk);
        return "📦 یه چیزی انداختم جلوی پات!";
      }
      return "چیزی تو کوله‌پشتیم نیست که بندازم!";
    }
    case "bow_to":
      return "احترام!";

    /* نبرد */
    case "guard_on":
      botManager.setGuardMode(true);
      return "🛡️ محافظت پلیسی روشن شد.";
    case "guard_off":
      botManager.setGuardMode(false);
      return "🛡️ محافظت خاموش شد.";
    case "autoattack_on":
      botManager.setAutoAttackMode(true);
      return "⚔️ اتوکلیک روشن شد.";
    case "autoattack_off":
      botManager.setAutoAttackMode(false);
      return "⚔️ اتوکلیک خاموش شد.";
    case "attack_nearest":
    case "attack_player": {
      const target =
        id === "attack_player"
          ? botManager.resolvePlayerEntity(args.player ?? ctx.player)
          : botManager.nearestHostile();
      if (!target) return "هدفی نزدیکم نیست.";
      if (bot) {
        await bot.attack(target);
        return `⚔️ زدم به ${target.name ?? "هدف"}!`;
      }
      return "ربات آماده نیست.";
    }

    /* حالت‌های شخصیتی و وود پمپ */
    case "personality_angry":
    case "personality_kind":
    case "personality_normal": {
      const mode =
        id === "personality_angry" ? "angry" : id === "personality_kind" ? "kind" : "normal";
      return botManager.setPersonality(mode).reply || "حالت عوض شد.";
    }
    case "speed_tp_on":
      return botManager.setSpeedBoost(true).reply || "سرعت زیاد شد!";
    case "speed_tp_off":
      return botManager.setSpeedBoost(false).reply || "سرعت عادی شد.";
    case "kill_squad": {
      const target = (args.player ?? args.text ?? "").trim() || ctx.player;
      if (!target) return "بگو کی رو بزنم!";
      const r = await botManager.killSquad(target);
      return r.reply || "!";
    }
    case "pickup_items":
      return botManager.pickupItems().reply || "برداشتم!";
    case "friend_add": {
      const name = (args.player ?? args.text ?? "").trim();
      if (!name) return "بگو کی رو به دوستان اضافه کنم!";
      const cur = getSettings().mcFriends;
      if (!cur.some((f) => f.toLowerCase() === name.toLowerCase())) {
        saveSettings({ mcFriends: [...cur, name] });
      }
      return `💙 «${name}» به لیست دوستان اضافه شد؛ حاضرم جونمو فداش کنم!`;
    }
    case "friend_remove": {
      const name = (args.player ?? args.text ?? "").trim();
      if (!name) return "بگو کی رو از دوستان حذف کنم!";
      saveSettings({
        mcFriends: getSettings().mcFriends.filter((f) => f.toLowerCase() !== name.toLowerCase())
      });
      return `«${name}» از لیست دوستان حذف شد.`;
    }
    case "server_register": {
      botManager.rawChat(`/register ${AUTH_PASSWORD} ${AUTH_PASSWORD}`);
      setTimeout(() => botManager.rawChat(`/login ${AUTH_PASSWORD}`), 900);
      return "🔐 دستور /register و /login با رمز ثابت ارسال شد.";
    }
    case "server_login": {
      botManager.rawChat(`/login ${AUTH_PASSWORD}`);
      return "🔐 دستور /login با رمز ثابت ارسال شد.";
    }

    case "flee":
      bot?.setControlState("sprint", true);
      bot?.setControlState("back", true);
      setTimeout(() => {
        bot?.setControlState("sprint", false);
        bot?.setControlState("back", false);
      }, 3000);
      return "🏃 در حال فرار!";
    case "shield_up":
    case "bow_shot":
    case "collect_arrows":
      return await botManager
        .runCommand(id === "collect_arrows" ? "تیر جمع کن" : "نگام کن")
        .then((r) => r.reply || cap.label);

    /* جمع‌آوری */
    case "collect_block": {
      const name = args.item ?? args.text ?? "stone";
      const r = await botManager.runCommand(`${name} جمع کن`);
      return r.reply || `در حال جمع‌آوری ${name}...`;
    }
    case "collect_all":
    case "gather_ore":
    case "gather_food":
    case "chop_trees":
    case "mine_vein":
    case "pickup_all":
    case "farm_harvest": {
      const map: Record<string, string> = {
        collect_all: "آیتم جمع کن",
        gather_ore: "سنگ معدن جمع کن",
        gather_food: "غذا جمع کن",
        chop_trees: "چوب جمع کن",
        mine_vein: "سنگ جمع کن",
        pickup_all: "آیتم جمع کن",
        farm_harvest: "گندم جمع کن"
      };
      const r = await botManager.runCommand(map[id]);
      return r.reply || cap.label;
    }
    case "mine_down":
    case "dig_down":
    case "dig_stairs":
    case "mine_forward": {
      const g = new (
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("mineflayer-pathfinder") as typeof import("mineflayer-pathfinder")
      ).goals.GoalBlock(
        Math.floor(bot?.entity.position.x ?? 0),
        Math.floor((bot?.entity.position.y ?? 64) - (id === "mine_forward" ? 0 : 5)),
        Math.floor((bot?.entity.position.z ?? 0) + (id === "mine_forward" ? 8 : 0))
      );
      bot?.pathfinder.setGoal(g);
      return `⛏️ ${cap.label} — شروع شد.`;
    }
    case "sort_inventory": {
      // مرتب‌سازی واقعی کوله — چیدن آیتم‌ها به ترتیب نوع با کلیک پنجره (swapSlots)
      try {
        if (!bot) return "🧱 وصل نیستم!";
        const items = bot.inventory.items();
        // ترتیب خواسته: بر اساس شناسهٔ نوع آیتم صعودی
        const wanted = [...items].sort((a, b) => a.type - b.type || (a.name < b.name ? -1 : 1));
        // اسلات‌های اصلی کوله: ۹ تا ۴۴
        const slots = items.map((it) => it.slot).filter((s) => s >= 9 && s <= 44);
        for (let i = 0; i < slots.length; i++) {
          const target = wanted[i];
          const cur = bot.inventory.slots[slots[i]];
          if (!target || !cur || target.slot === cur.slot) continue;
          // جای این دو تا را عوض کن
          const a = cur.slot, b = target.slot;
          await bot.clickWindow(a, 0, 0);
          await bot.clickWindow(b, 0, 0);
          if (bot.heldItem) await bot.clickWindow(a, 0, 0);
        }
        return "🎒 کوله مرتب شد — همه چی سر جاش چیده شد!";
      } catch {
        return "😅 نتونستم کوله رو مرتب کنم (پنجره‌ای بازه یا سرور اجازه نداد).";
      }
    }
    case "place_block": {
      // گذاشتن واقعی بلوک جلوی پا با mineflayer
      try {
        if (!bot) return "🧱 وصل نیستم!";
        const tools = /(sword|pickaxe|axe|shovel|hoe|bow|rod|food|apple|bread|meat)/;
        const item = bot.inventory.items().find((it) => !tools.test(it.name));
        if (!item) return "🧱 توی کولمم بلوکی نیست که بذارم!";
        await bot.equip(item, "hand");
        const ref = bot.findBlock({
          matching: (b) => !!b && b.boundingBox === "block",
          maxDistance: 5
        });
        if (!ref) return "🧱 نزدیکم بلوکی نیست که روش بذارم!";
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Vec3 } = require("vec3") as typeof import("vec3");
        await bot.placeBlock(ref, new Vec3(0, 1, 0));
        return "🧱 بلوک رو گذاشتم!";
      } catch {
        return "😅 نتونستم بلوک بذارم (شاید دستم پر بود یا جا نبود).";
      }
    }
    case "clear_area":
    case "house":
    case "build_tower":
    case "build_wall":
    case "build_cube":
    case "build_platform":
    case "setblock":
    case "clone_area":
    case "torch_line":
      return cap.label + " (نیاز به OP) — انجام شد.";

    case "scan_radius": {
      // تنظیم شعاع اسکن محیط (۱۰۰ تا ۱۰۰۰۰۰ بلوک) — بدون نیاز به سرور
      const { saveSettings } = await import("@/lib/store");
      const n = Math.max(100, Math.min(100000, Math.round(Number(args.n ?? 1000) || 1000)));
      saveSettings({ mcScanRadius: n });
      return `🔎 شعاع اسکن محیط روی ${toPersianDigits(String(n))} بلوک تنظیم شد (تا ۱۰۰۰۰۰ قابل افزایش).`;
    }

    /* چت */
    case "say": {
      const text = args.text ?? args.item ?? "سلام!";
      botManager.rawChat(text);
      return `💬 گفتم: «${text}»`;
    }
    case "whisper":
    case "call_me":
    case "greet_player":
    case "tell_coords": {
      const who = args.player ?? ctx.player ?? "";
      const msg =
        id === "tell_coords"
          ? `📍 مختصاتم: ${snap.pos ? `${snap.pos.x} ${snap.pos.y} ${snap.pos.z}` : "?"}`
          : id === "greet_player"
            ? `سلام ${who}! خوش اومدی 🎉`
            : id === "call_me"
              ? `${who} صدات می‌کنم!`
              : args.text ?? "سلام!";
      botManager.rawChat(who && id === "whisper" ? `/msg ${who} ${msg}` : msg);
      return "💬 پیام رفت.";
    }
    case "chat_bridge_on":
    case "chat_bridge_off":
      return "برای این مورد از کلید «گفت‌وگوی داخل بازی» در صفحهٔ ماینکرفت استفاده کن.";

    /* ---------- حرکت پیشرفته ---------- */
    case "walk_forward":
      bot?.setControlState("forward", true);
      setTimeout(() => bot?.setControlState("forward", false), 2500);
      return "🚶 چند قدم جلو رفتم...";
    case "turn_left":
    case "turn_right": {
      const yaw = (bot?.entity?.yaw ?? 0) + (id === "turn_left" ? Math.PI / 2 : -Math.PI / 2);
      await bot?.look(yaw, 0);
      return id === "turn_left" ? "↩️ به چپ چرخیدم" : "↪️ به راست چرخیدم";
    }
    case "look_sky":
      await bot?.look(bot?.entity?.yaw ?? 0, -Math.PI / 2);
      return "🌌 سرم رو به آسمون بلند کردم!";
    case "look_ground":
      await bot?.look(bot?.entity?.yaw ?? 0, Math.PI / 2);
      return "⬇️ دارم زمین رو نگاه می‌کنم";
    case "nod":
      await bot?.look(bot?.entity?.yaw ?? 0, 0.6);
      await bot?.look(bot?.entity?.yaw ?? 0, -0.2);
      return "😊 سر تکون دادم (آره!)";
    case "shake_head": {
      const y0 = bot?.entity?.yaw ?? 0;
      for (let i = 0; i < 4; i++) await bot?.look(y0 + (i % 2 ? 0.7 : -0.7), 0);
      await bot?.look(y0, 0);
      return "🙅 سرم رو تکون دادم (نه!)";
    }
    case "jump_n": {
      const n = Math.min(Math.max(Number(args.n ?? 3) || 3, 1), 10);
      for (let i = 0; i < n; i++) {
        bot?.setControlState("jump", true);
        await new Promise((r) => setTimeout(r, 450));
        bot?.setControlState("jump", false);
        await new Promise((r) => setTimeout(r, 250));
      }
      return `🐇 ${toPersianDigits(String(n))} بار پریدم!`;
    }
    case "sprint_burst":
      bot?.setControlState("sprint", true);
      bot?.setControlState("forward", true);
      setTimeout(() => {
        bot?.setControlState("sprint", false);
        bot?.setControlState("forward", false);
      }, 3000);
      return "💨 اسپرینت!";
    case "dodge_left":
    case "dodge_right":
      bot?.setControlState(id === "dodge_left" ? "left" : "right", true);
      setTimeout(() => bot?.setControlState(id === "dodge_left" ? "left" : "right", false), 700);
      return id === "dodge_left" ? "↩️ جاخالی به چپ!" : "↪️ جاخالی به راست!";
    case "happy_jump": {
      for (let i = 0; i < 3; i++) {
        bot?.setControlState("jump", true);
        await new Promise((r) => setTimeout(r, 400));
        bot?.setControlState("jump", false);
        await new Promise((r) => setTimeout(r, 200));
      }
      await bot?.look((bot?.entity?.yaw ?? 0) + Math.PI * 2, 0);
      return "🥳 از خوشحالی پریدم!";
    }

    /* ---------- نبرد پیشرفته ---------- */
    case "attack_hostile":
    case "crit_attack":
    case "rapid_attack": {
      const target = bot?.nearestEntity((e) => e.kind === "Hostile");
      if (!target) return "🎯 خصمی نزدیکم نیست!";
      if (id === "crit_attack") {
        bot?.setControlState("jump", true);
        await new Promise((r) => setTimeout(r, 300));
        bot?.setControlState("jump", false);
        await new Promise((r) => setTimeout(r, 150));
        bot?.attack(target);
        return "💥 ضربهٔ کریتیکال!";
      }
      if (id === "rapid_attack") {
        for (let i = 0; i < 4; i++) {
          bot?.attack(target);
          await new Promise((r) => setTimeout(r, 350));
        }
        return "⚡ ۴ ضربهٔ سریع زدم!";
      }
      bot?.attack(target);
      return "⚔️ به خصم حمله کردم!";
    }
    case "taunt":
      botManager.rawChat("نمی‌تونی بهم برسی! 😜");
      bot?.setControlState("sneak", true);
      setTimeout(() => bot?.setControlState("sneak", false), 800);
      return "😜 دشمن رو مسخره کردم!";
    case "throw_pearl":
    case "throw_snowball":
    case "throw_egg": {
      const itemName =
        id === "throw_pearl" ? "ender_pearl" : id === "throw_snowball" ? "snowball" : "egg";
      const item = bot?.inventory.items().find((it) => it.name === itemName);
      if (!item) return `🎒 ${itemName} توی کوله‌بارم نیست!`;
      await bot?.equip(item, "hand");
      bot?.activateItem();
      return id === "throw_pearl" ? "🔮 مروارید پرتاب شد!" : id === "throw_snowball" ? "❄️ گوله برف پرتاب شد!" : "🥚 تخم‌مرغ پرتاب شد!";
    }
    case "equip_shield": {
      const shield = bot?.inventory.items().find((it) => it.name === "shield");
      if (!shield) return "🛡️ سپری توی کوله‌بارم نیست!";
      await bot?.equip(shield, "off-hand");
      return "🛡️ سپر رو گرفتم!";
    }
    case "clap":
      for (let i = 0; i < 5; i++) {
        bot?.swingArm("right");
        await new Promise((r) => setTimeout(r, 220));
      }
      return "👏 دست زدم!";

    /* ---------- بقا و تعامل ---------- */
    case "eat_now": {
      const foods = new Set([
        "bread", "steak", "cooked_beef", "cooked_porkchop", "cooked_chicken", "cooked_cod",
        "cooked_salmon", "apple", "golden_apple", "golden_carrot", "carrot", "potato",
        "baked_potato", "cookie", "melon_slice", "pumpkin_pie", "dried_kelp", "beef",
        "porkchop", "chicken", "cod", "salmon", "sweet_berries", "chorus_fruit", "honey_bottle"
      ]);
      const food = bot?.inventory.items().find((it) => foods.has(it.name));
      if (!food) return "🍖 غذایی توی کوله‌بارم نیست!";
      await bot?.equip(food, "hand");
      bot?.activateItem();
      return `🍽️ دارم ${food.displayName} می‌خورم...`;
    }
    case "drink_potion": {
      const pot = bot?.inventory
        .items()
        .find((it) => it.name === "potion" || it.name === "milk_bucket" || it.name === "suspicious_stew");
      if (!pot) return "🧪 اکسیری توی کوله‌بارم نیست!";
      await bot?.equip(pot, "hand");
      bot?.activateItem();
      return "🧪 دارم می‌نوشمش...";
    }
    case "sleep_now": {
      const bed = bot?.findBlock({
        matching: (b) => b.name.endsWith("_bed"),
        maxDistance: 8
      });
      if (!bed) return "🛏️ تختی این اطراف نیست!";
      try {
        await bot?.sleep(bed);
        return "😴 خوابیدم... شب بخیر!";
      } catch {
        return "😴 الان نمی‌تونم بخوابم (شاید شب نیست یا تخت اشغاله).";
      }
    }
    case "wake_up":
      try {
        await bot?.wake();
        return "☀️ بیدار شدم!";
      } catch {
        return "☀️ اصلاً خواب نبودم!";
      }
    case "fish_start": {
      const rod = bot?.inventory.items().find((it) => it.name === "fishing_rod");
      if (!rod) return "🎣 قلاب ماهیگیری ندارم!";
      await bot?.equip(rod, "hand");
      bot?.activateItem();
      return "🎣 قلاب رو انداختم!";
    }
    case "fish_stop":
      bot?.deactivateItem();
      return "🎣 قلاب رو جمع کردم.";
    case "mount_nearest": {
      const ride = bot?.nearestEntity(
        (e) =>
          e.kind === "Object" ||
          ["horse", "donkey", "mule", "llama", "pig", "strider", "camel", "boat", "minecart", "skeleton_horse", "zombie_horse"].some(
            (k) => (e.name ?? "").includes(k)
          )
      );
      if (!ride) return "🐴 چیز سواری این اطراف نیست!";
      try {
        await bot?.mount(ride);
        return "🐴 سوار شدم!";
      } catch {
        return "🐴 نشد سوار بشم!";
      }
    }
    case "dismount_now":
      await bot?.dismount();
      return "🧍 پیاده شدم";
    case "open_door":
    case "press_button":
    case "ring_bell":
    case "light_campfire":
    case "extinguish_campfire": {
      const matcher: Record<string, (n: string) => boolean> = {
        open_door: (n) => n.includes("_door") || n.includes("_trapdoor"),
        press_button: (n) => n.includes("button") || n.includes("lever"),
        ring_bell: (n) => n === "bell",
        light_campfire: (n) => n === "campfire" || n === "soul_campfire",
        extinguish_campfire: (n) => n === "campfire" || n === "soul_campfire"
      };
      const block = bot?.findBlock({
        matching: (b) => matcher[id](b.name),
        maxDistance: 6
      });
      if (!block) return "🧱 چیز مناسبی این اطراف نیست!";
      if (id === "extinguish_campfire") {
        bot?.setControlState("sneak", true);
        await bot?.activateBlock(block);
        bot?.setControlState("sneak", false);
        return "🔥 آتش خاموش شد.";
      }
      await bot?.activateBlock(block);
      return `✅ ${cap.label} — انجام شد.`;
    }
    case "shear_sheep": {
      const shears = bot?.inventory.items().find((it) => it.name === "shears");
      const sheep = bot?.nearestEntity((e) => (e.name ?? "") === "sheep");
      if (!shears || !sheep) return "✂️ یا قیچی ندارم یا گوسفندی نیست!";
      await bot?.equip(shears, "hand");
      await bot?.activateEntity(sheep);
      return "✂️ پشم چیدم!";
    }
    case "milk_cow": {
      const bucket = bot?.inventory.items().find((it) => it.name === "bucket");
      const cow = bot?.nearestEntity((e) => (e.name ?? "") === "cow" || (e.name ?? "") === "mooshroom");
      if (!bucket || !cow) return "🥛 یا سطل ندارم یا گاوی نیست!";
      await bot?.equip(bucket, "hand");
      await bot?.activateEntity(cow);
      return "🥛 شیر دوشیدم!";
    }
    case "breed_animals": {
      const wheat = bot?.inventory.items().find((it) => it.name === "wheat");
      if (!wheat) return "🌾 گندم ندارم!";
      await bot?.equip(wheat, "hand");
      const animals = Object.values(bot?.entities ?? {}).filter((e) =>
        ["cow", "sheep", "pig"].includes(e.name ?? "")
      );
      for (const a of animals.slice(0, 2)) {
        await bot?.activateEntity(a);
        await new Promise((r) => setTimeout(r, 500));
      }
      return animals.length >= 2 ? "💕 حیوانات عاشق شدن!" : "🐾 حداقل باید دو تا حیوان اینجا باشه.";
    }
    case "place_torch_feet": {
      const torch = bot?.inventory.items().find((it) => it.name === "torch");
      const ref = bot?.entity ? bot.blockAt(bot.entity.position.offset(0, -1, 0)) : null;
      if (!torch || !ref || !bot?.entity) return "🔥 یا مشعل ندارم یا زیر پام جایی نیست!";
      await bot.equip(torch, "hand");
      const face = bot.entity.position.offset(0, 1, 0).minus(bot.entity.position);
      await bot.placeBlock(ref, face);
      return "🔥 مشعل رو گذاشتم!";
    }

    /* ---------- کوله‌بار ---------- */
    case "toss_stack": {
      const held = bot?.heldItem;
      if (!held) return "✋ دستم خالیه!";
      await bot?.toss(held.type, held.metadata, held.count);
      return "📦 آیتم دستم رو انداختم.";
    }
    case "toss_all": {
      const items = bot?.inventory.items() ?? [];
      for (const it of items) {
        await bot?.toss(it.type, it.metadata, it.count);
        await new Promise((r) => setTimeout(r, 120));
      }
      return `🗑️ ${toPersianDigits(String(items.length))} تا آیتم روی زمین ریختم.`;
    }
    case "hold_item": {
      const want = (args.item ?? args.text ?? "").toLowerCase().replace(/\s+/g, "_");
      const item = bot?.inventory
        .items()
        .find((it) => it.name.includes(want) || it.displayName?.toLowerCase().includes(want));
      if (!item) return `🎒 «${args.item ?? "؟"}» رو توی کوله‌بارم پیدا نکردم!`;
      await bot?.equip(item, "hand");
      return `🖐️ ${item.displayName} رو دستم گرفتم.`;
    }
    case "select_slot": {
      const slot = Math.min(Math.max(Number(args.n ?? 1) || 1, 1), 9) - 1;
      bot?.setQuickBarSlot(slot);
      return `🔢 خانهٔ ${toPersianDigits(String(slot + 1))} انتخاب شد.`;
    }
    case "armor_best": {
      const slots: { dest: "head" | "torso" | "legs" | "feet"; names: string[] }[] = [
        { dest: "head", names: ["netherite_helmet", "diamond_helmet", "iron_helmet", "golden_helmet", "chainmail_helmet", "leather_helmet", "turtle_helmet"] },
        { dest: "torso", names: ["netherite_chestplate", "diamond_chestplate", "iron_chestplate", "golden_chestplate", "chainmail_chestplate", "leather_chestplate"] },
        { dest: "legs", names: ["netherite_leggings", "diamond_leggings", "iron_leggings", "golden_leggings", "chainmail_leggings", "leather_leggings"] },
        { dest: "feet", names: ["netherite_boots", "diamond_boots", "iron_boots", "golden_boots", "chainmail_boots", "leather_boots"] }
      ];
      let worn = 0;
      for (const s of slots) {
        const item = bot?.inventory.items().find((it) => s.names.includes(it.name));
        if (item) {
          await bot?.equip(item, s.dest);
          worn++;
        }
      }
      return worn ? `🛡️ ${toPersianDigits(String(worn))} تکه زره پوشیدم!` : "🛡️ زره‌ای توی کوله‌بارم نیست.";
    }
    case "swap_hands": {
      const swapper = bot as unknown as { swapHandItems?: () => Promise<void> | void } | null;
      await swapper?.swapHandItems?.();
      return "🔄 دست‌هام رو عوض کردم.";
    }
    case "clean_inventory": {
      const junk = new Set([
        "rotten_flesh", "spider_eye", "poisonous_potato", "wheat_seeds", "string",
        "feather", "flint", "clay_ball", "netherrack", "cobbled_deepslate", "dirt"
      ]);
      const drops = (bot?.inventory.items() ?? []).filter((it) => junk.has(it.name));
      for (const it of drops) {
        await bot?.toss(it.type, it.metadata, it.count);
        await new Promise((r) => setTimeout(r, 120));
      }
      return drops.length
        ? `🗑️ ${toPersianDigits(String(drops.length))} تا آشغال دور ریختم.`
        : "✨ کوله‌بارم تمیزه!";
    }
    case "refill_totem": {
      const totem = bot?.inventory.items().find((it) => it.name === "totem_of_undying");
      if (!totem) return "🗿 تاتمی ندارم!";
      await bot?.equip(totem, "off-hand");
      return "🗿 تاتم رو در دست فرعی گذاشتم.";
    }
    case "dig_tunnel": {
      const n = Math.min(Math.max(Number(args.n ?? 5) || 5, 1), 15);
      const yaw = bot?.entity?.yaw ?? 0;
      const dx = -Math.sin(yaw);
      const dz = Math.cos(yaw);
      let dug = 0;
      for (let i = 0; i < n; i++) {
        for (const dy of [0, 1]) {
          const p = bot?.entity?.position.offset(dx, dy, dz);
          const b = p ? bot?.blockAt(p) : null;
          if (b && b.name !== "air" && b.name !== "cave_air") {
            try {
              await bot?.dig(b);
              dug++;
            } catch {
              /* بلوک بعدی */
            }
          }
        }
        bot?.setControlState("forward", true);
        await new Promise((r) => setTimeout(r, 650));
        bot?.setControlState("forward", false);
      }
      return `⛏️ تونل ${toPersianDigits(String(n))} متری حفر شد (${toPersianDigits(String(dug))} بلوک)!`;
    }
    case "dig_shaft": {
      const n = Math.min(Math.max(Number(args.n ?? 5) || 5, 1), 15);
      let dug = 0;
      for (let i = 0; i < n; i++) {
        const b = bot?.entity ? bot.blockAt(bot.entity.position.offset(0, -1, 0)) : null;
        if (b && b.name !== "air" && b.name !== "cave_air") {
          try {
            await bot?.dig(b);
            dug++;
          } catch {
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 350));
      }
      return `⛏️ چاه ${toPersianDigits(String(dug))} بلوکی کندم!`;
    }

    /* ---------- سرگرمی گفتاری ---------- */
    case "sing_chat":
      botManager.rawChat("♪ ♫ ♪ لا لا لا ♫ ♪");
      return "🎵 آواز خوندم!";
    case "tell_joke_chat":
      botManager.rawChat("به ماهی گفتن چرا ساکتی؟ گفت: آب دهنم بسته‌ست! 🐟");
      return "😂 جوک رو توی چت گفتم!";
    case "count_down": {
      for (const s of ["۳...", "۲...", "۱...", "بریم! 🚀"]) {
        botManager.rawChat(s);
        await new Promise((r) => setTimeout(r, 900));
      }
      return "⏳ شمارش معکوس انجام شد!";
    }
    case "roar":
      botManager.rawChat("ROAAAR! 🦁");
      await bot?.look((bot?.entity?.yaw ?? 0) + Math.PI * 2, 0);
      return "🦁 غرش!";
    case "freeze":
      for (const k of ["forward", "back", "left", "right", "jump", "sprint"] as const) {
        bot?.setControlState(k, false);
      }
      bot?.setControlState("sneak", true);
      return "🧊 یخ زدم!";
    case "unfreeze":
      bot?.setControlState("sneak", false);
      return "🔥 آب شدم — آماده‌ام!";

    /* ═════════════════ سطح خدا — اجراکننده‌ها ═════════════════ */
    case "god_mode_on": {
      for (const e of [
        "effect give {p} resistance 999 4",
        "effect give {p} absorption 999 4",
        "effect give {p} regeneration 999 2",
        "effect give {p} health_boost 999 4",
        "effect give {p} fire_resistance 999 0",
        "effect give {p} night_vision 999 0"
      ]) botManager.opCommand(e.replaceAll("{p}", player));
      return "👑 حالت خدا روشن شد — الان شکست‌ناپذیری!";
    }
    case "god_mode_off": {
      botManager.opCommand(`effect clear ${player}`);
      botManager.opCommand("gamemode survival " + player);
      return "👑 حالت خدا خاموش شد — برگشتی به حالت عادی.";
    }
    case "god_heal": {
      botManager.opCommand(`effect give ${player} instant_health 1 20`);
      botManager.opCommand(`effect give ${player} saturation 1 20`);
      return "💖 شفا مطلق — جان و سیری کامل شد!";
    }
    case "god_kit": {
      for (const c of [
        `give ${player} netherite_sword 1`,
        `give ${player} netherite_pickaxe 1`,
        `give ${player} netherite_helmet 1`,
        `give ${player} netherite_chestplate 1`,
        `give ${player} netherite_leggings 1`,
        `give ${player} netherite_boots 1`,
        `give ${player} totem_of_undying 2`,
        `give ${player} golden_apple 16`,
        `give ${player} ender_pearl 16`
      ]) botManager.opCommand(c);
      return "👑 کیت خدا تحویل داده شد — ست کامل ندریت!";
    }
    case "one_punch":
      botManager.opCommand(`attribute ${player} minecraft:generic.attack_damage base set 1000`);
      return "👊 مشت یک‌ضربه‌ای — هر چیزی با یک ضربه می‌میره!";
    case "god_health":
      botManager.opCommand(`attribute ${player} minecraft:generic.max_health base set 2048`);
      botManager.opCommand(`effect give ${player} instant_health 1 20`);
      return "💚 جان ابدی — ۲۰۴۸ قلب!";
    case "god_speed":
      botManager.opCommand(`effect give ${player} speed 999 255`);
      return "💨 سرعت خدا — مافوق صوت!";
    case "god_jump":
      botManager.opCommand(`effect give ${player} jump_boost 999 250`);
      botManager.opCommand(`effect give ${player} slow_falling 999 0`);
      return "🦘 پرش خدا — بالاتر از ابرها!";
    case "god_vision":
      botManager.opCommand(`effect give ${player} night_vision 999 0`);
      botManager.opCommand("effect give @e[type=!player] glowing 999 0");
      return "👁️ دید خدا — همهٔ ماب‌ها از پشت دیوار می‌درخشن!";
    case "god_strength":
      botManager.opCommand(`effect give ${player} strength 999 255`);
      return "💪 قدرت خدا — سطح ۲۵۵!";
    case "god_regen":
      botManager.opCommand(`effect give ${player} regeneration 999 255`);
      return "💗 بازسازی ابدی — همیشه در حال شفا!";
    case "god_vanish":
      botManager.opCommand(`effect give ${player} invisibility 999 255`);
      return "👻 نامرئی مطلق — هیچ‌کس نمی‌بیندت!";
    case "pyramid_mega": {
      for (let layer = 0; layer < 6; layer++) {
        const r = 10 - layer * 2;
        botManager.opCommand(`fill ~-${r} ${layer - 1} ~-${r} ~${r} ${layer - 1} ~${r} sandstone`);
      }
      return "🏛️ هرم عظیم ۶ لایه ساخته شد!";
    }
    case "arena_op": {
      botManager.opCommand("fill ~-15 ~-1 ~-15 ~15 ~8 ~15 stone_brick hollow");
      botManager.opCommand("fill ~-15 ~-1 ~-15 ~15 ~-1 ~15 smooth_stone");
      return "⚔️ آرنای نبرد آماده است!";
    }
    case "farm_op": {
      botManager.opCommand("fill ~-6 ~-1 ~-6 ~6 ~-1 ~6 farmland");
      botManager.opCommand("fill ~-1 ~-1 ~-1 ~1 ~-1 ~1 water");
      return "🌾 مزرعه با آب مرکزی ساخته شد!";
    }
    case "meteor_strike": {
      for (const off of ["~-4 ~12 ~-3", "~3 ~15 ~2", "~0 ~20 ~-6"]) {
        botManager.opCommand(`summon fireball ${off} {ExplosionPower:3b}`);
      }
      botManager.opCommand("summon tnt ~2 ~8 ~2");
      botManager.opCommand("summon tnt ~-2 ~10 ~-2");
      return "☄️ شهاب‌سنگ‌ها در راهن!";
    }
    case "nuke_area": {
      for (const off of [
        "~-3 ~ ~-3", "~3 ~ ~-3", "~-3 ~ ~3", "~3 ~ ~3",
        "~ ~5 ~", "~-5 ~2 ~", "~5 ~2 ~", "~ ~2 ~-5"
      ]) botManager.opCommand(`summon tnt ${off}`);
      return "💣 بمب اتمی رها شد — فاصله بگیر!";
    }
    case "zombie_apocalypse": {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 6);
        const z = Math.round(Math.sin(a) * 6);
        botManager.opCommand(`summon zombie ~${x} ~ ~${z}`);
      }
      return "🧟 آخرالزمان زامبی آغاز شد!";
    }
    case "wither_storm": {
      for (const off of ["~-5 ~2 ~-5", "~5 ~2 ~-5", "~ ~2 ~5"]) {
        botManager.opCommand(`summon wither ${off}`);
      }
      return "💀 طوفان ویزر — خدا به همراهت باشه!";
    }
    case "thunderstorm_op":
      botManager.opCommand("weather thunder");
      botManager.opCommand("time set midnight");
      return "⛈️ طوفان رعد آغاز شد — آسمان تاریک شد!";
    case "daylight_forever":
      botManager.opCommand("gamerule doDaylightCycle false");
      botManager.opCommand("time set day");
      botManager.opCommand("weather clear");
      return "☀️ روز ابدی — خورشید دیگه غروب نمی‌کنه!";
    case "peaceful_forever":
      botManager.opCommand("difficulty peaceful");
      botManager.opCommand("gamerule doMobSpawning false");
      botManager.opCommand("kill @e[type=zombie]");
      botManager.opCommand("kill @e[type=skeleton]");
      botManager.opCommand("kill @e[type=creeper]");
      botManager.opCommand("kill @e[type=spider]");
      return "🕊️ صلح ابدی — دیگه هیچ مابی نیست!";
    case "time_stop":
      botManager.opCommand("gamerule doDaylightCycle false");
      botManager.opCommand("gamerule doWeatherCycle false");
      botManager.opCommand("gamerule doMobSpawning false");
      botManager.opCommand("effect give @e[type=!player] slowness 999 255");
      return "⏳ زمان ایستاد — دنیا منجمد شد!";
    case "time_resume":
      botManager.opCommand("gamerule doDaylightCycle true");
      botManager.opCommand("gamerule doWeatherCycle true");
      botManager.opCommand("gamerule doMobSpawning true");
      botManager.opCommand("effect clear @e[type=!player]");
      return "▶️ زمان جاری شد — همه‌چیز عادی شد!";
    case "super_hero_landing": {
      botManager.opCommand(`effect give ${player} slow_falling 15 0`);
      botManager.opCommand(`tp ${player} ~ ~40 ~`);
      return "🦸 پرواز به ارتفاع ۴۰ — فرود ابرقهرمانی در راهه!";
    }
    case "god_roar":
      botManager.rawChat("ROAAAR! ☠️ خدا آمد!");
      botManager.opCommand(`summon lightning_bolt ~3 ~ ~3`);
      botManager.opCommand(`summon lightning_bolt ~-3 ~ ~-3`);
      bot?.look((bot?.entity?.yaw ?? 0) + Math.PI * 2, 0);
      return "🌩️ غرش خدا — آسمان لرزید!";
    case "disco_party": {
      botManager.rawChat("🪩 پارتی دیسکو شروع شد!");
      botManager.opCommand("playsound entity.player.levelup master @a");
      botManager.opCommand("particle heart ~ ~2 ~ 4 2 4 0 60");
      botManager.opCommand("particle note ~ ~2 ~ 4 2 4 0 60");
      botManager.opCommand("particle flame ~ ~1 ~ 3 1 3 0 40");
      for (let i = 0; i < 3; i++) {
        bot?.setControlState("jump", true);
        await new Promise((r) => setTimeout(r, 400));
        bot?.setControlState("jump", false);
        await new Promise((r) => setTimeout(r, 200));
      }
      return "🪩 پارتی دیسکوی خدایی!";
    }

    /* ═════════════════ ویژه — اجراکننده‌ها ═════════════════ */
    case "pet_wolf_army":
      for (let i = 0; i < 3; i++) {
        botManager.opCommand(`summon wolf ~${i * 2 - 2} ~ ~ {Tame:1b,Owner:"${player}",CustomName:'"سگ نگهبان ${i + 1}"'}`);
      }
      return "🐺 سه سگ نگهبان رام‌شده آماده‌اند!";
    case "pet_cats":
      for (let i = 0; i < 3; i++) {
        botManager.opCommand(`summon cat ~${i * 2 - 2} ~ ~ {Tame:1b,Owner:"${player}",CustomName:'"گربهٔ رئیس"'}`);
      }
      return "🐱 سه گربهٔ رام‌شده آمدن!";
    case "rainbow_sheep": {
      const colors = [14, 11, 5, 4, 9]; // قرمز، سبز، قهوه‌ای، آبی، خاکستری-آبی
      colors.forEach((c, i) => {
        const a = (i / 5) * Math.PI * 2;
        botManager.opCommand(`summon sheep ~${Math.round(Math.cos(a) * 3)} ~ ~${Math.round(Math.sin(a) * 3)} {Color:${c}}`);
      });
      return "🌈 پنج گوسفند رنگی دورت چیده شدن!";
    }
    case "baby_zoo":
      for (const [i, mob] of ["cow", "pig", "chicken", "wolf"].entries()) {
        botManager.opCommand(`summon ${mob} ~${i * 2 - 3} ~ ~ {Age:-24000}`);
      }
      return "🍼 چهار تا بچه‌حیوان ناز!";
    case "ender_crystal_ring":
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        botManager.opCommand(`summon ender_crystal ~${Math.round(Math.cos(a) * 5)} ~2 ~${Math.round(Math.sin(a) * 5)}`);
      }
      return "🔮 حلقهٔ کریستال درخشان!";
    case "firework_show":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        botManager.opCommand(
          `summon firework_rocket ~${Math.round(Math.cos(a) * 4)} ~1 ~${Math.round(Math.sin(a) * 4)} {FireworksItem:{id:"firework_rocket",Count:1,tag:{Explosions:[{Type:1b,Colors:[I;11743532,5635925,16711680,65280,255]}]}}}`
        );
      }
      return "🎆 نمایش آتش‌بازی آغاز شد!";
    case "diamond_rain":
      for (let i = 0; i < 6; i++) {
        botManager.opCommand(`summon item ~${(i % 3) - 1} ~12 ~${Math.floor(i / 3) - 1} {Item:{id:"diamond",Count:1}}`);
      }
      return "💎 الماس از آسمون می‌باره!";
    case "xp_rain":
      for (let i = 0; i < 6; i++) {
        botManager.opCommand(`summon experience_orb ~${(i % 3) - 1} ~10 ~${Math.floor(i / 3) - 1} {Value:50}`);
      }
      return "⭐ بارش تجربه!";
    case "lightning_ring":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        botManager.opCommand(`summon lightning_bolt ~${Math.round(Math.cos(a) * 6)} ~ ~${Math.round(Math.sin(a) * 6)}`);
      }
      return "🌩️ حلقهٔ صاعقه — باشکوه!";
    case "beacon_beam":
      botManager.opCommand("fill ~-1 ~-2 ~-1 ~1 ~-2 ~1 iron_block");
      botManager.opCommand("fill ~-1 ~-1 ~-1 ~1 ~-1 ~1 iron_block");
      botManager.opCommand("setblock ~ ~-1 ~ beacon");
      return "🗼 ستون نور تا آسمان رفت!";
    case "parkour_course":
      botManager.opCommand("fill ~3 ~2 ~3 ~5 ~2 ~5 quartz_block");
      botManager.opCommand("fill ~8 ~5 ~8 ~10 ~5 ~10 quartz_block");
      botManager.opCommand("fill ~13 ~8 ~13 ~15 ~8 ~15 quartz_block");
      return "🏃 سه سکوی پارکور آماده شد!";
    case "maze_op":
      botManager.opCommand("fill ~-8 ~-1 ~-2 ~8 ~2 ~-2 cobblestone hollow");
      botManager.opCommand("fill ~-2 ~-1 ~-8 ~-2 ~2 ~8 cobblestone hollow");
      botManager.opCommand("fill ~4 ~-1 ~-8 ~4 ~2 ~2 cobblestone hollow");
      return "🌀 هزارتو ساخته شد — گم نشو!";
    case "miner_pack":
      for (const c of [`give ${player} netherite_pickaxe 1`, `give ${player} torch 64`, `give ${player} cooked_beef 32`, `give ${player} shield 1`]) botManager.opCommand(c);
      return "⛏️ کیت معدنچی آماده است!";
    case "builder_pack":
      for (const c of [`give ${player} oak_planks 64`, `give ${player} stone 64`, `give ${player} glass 64`, `give ${player} torch 32`, `give ${player} brick 64`]) botManager.opCommand(c);
      return "🧱 کیت سازنده آماده است!";
    case "warrior_pack":
      for (const c of [`give ${player} netherite_sword 1`, `give ${player} bow 1`, `give ${player} arrow 64`, `give ${player} shield 1`, `give ${player} golden_apple 16`]) botManager.opCommand(c);
      return "⚔️ کیت جنگجو آماده است!";
    case "farmer_pack":
      for (const c of [`give ${player} netherite_hoe 1`, `give ${player} wheat_seeds 64`, `give ${player} wheat 32`, `give ${player} bone_meal 64`]) botManager.opCommand(c);
      return "🌾 کیت کشاورز آماده است!";
    case "explorer_pack":
      for (const c of [`give ${player} cooked_beef 32`, `give ${player} torch 64`, `give ${player} oak_boat 1`, `give ${player} red_bed 1`, `give ${player} compass 1`, `give ${player} map 4`]) botManager.opCommand(c);
      return "🧭 کیت کاوشگر آماده است!";
    case "challenge_wave":
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        botManager.opCommand(`summon zombie ~${Math.round(Math.cos(a) * 7)} ~ ~${Math.round(Math.sin(a) * 7)}`);
        botManager.opCommand(`summon skeleton ~${Math.round(Math.cos(a) * 7)} ~ ~${Math.round(Math.sin(a) * 7)}`);
      }
      return "🌊 موج دشمن حمله کرد — مواظب باش!";
    case "boss_rush":
      botManager.opCommand(`summon zombie ~-5 ~ ~-5 {CustomName:'"رئیس زامبی"',Health:200f,Attributes:[{Name:generic.max_health,Base:200},{Name:generic.attack_damage,Base:10}]}`);
      botManager.opCommand(`summon skeleton ~5 ~ ~-5 {CustomName:'"رئیس اسکلت"',Health:150f,Attributes:[{Name:generic.max_health,Base:150}]}`);
      botManager.opCommand(`summon creeper ~ ~ ~5 {powered:1b,CustomName:'"کریپر شارژی"'}`);
      return "👹 رالی باس شروع شد — فقط بهترین‌ها دوام میارن!";
    case "night_swim":
      botManager.opCommand(`effect give ${player} water_breathing 999 0`);
      botManager.opCommand(`effect give ${player} night_vision 999 0`);
      botManager.opCommand(`effect give ${player} dolphins_grace 999 0`);
      return "🌙 غواصی حرفه‌ای — تنفس آبی + دید شب!";
    case "home_anchor_op":
      botManager.opCommand("setworldspawn");
      botManager.opCommand(`give ${player} compass 1`);
      return "🏠 اسپاون اینجا ثبت شد + قطب‌نما گرفتی!";
    case "speed_builder":
      botManager.opCommand(`effect give ${player} haste 999 255`);
      for (const c of [`give ${player} oak_planks 64`, `give ${player} stone 64`, `give ${player} glass 64`]) botManager.opCommand(c);
      return "⚡ عجلهٔ ۲۵۵ + بلوک — بساز!";

    /* ═════════════════ خفن — اجراکننده‌ها ═════════════════ */
    case "ultimate_warrior":
      await executeCapability("warrior_pack", {}, ctx);
      await executeCapability("god_mode_on", {}, ctx);
      await executeCapability("one_punch", {}, ctx);
      return "🗡️ جنگجوی افسانه‌ای — الان واقعاً شکست‌ناپذیری!";
    case "ultimate_builder":
      await executeCapability("speed_builder", {}, ctx);
      await executeCapability("god_speed", {}, ctx);
      return "🏗️ سازندهٔ افسانه‌ای — بساز بترکون!";
    case "ultimate_survivor":
      await executeCapability("god_kit", {}, ctx);
      await executeCapability("night_swim", {}, ctx);
      await executeCapability("god_vision", {}, ctx);
      return "🛡️ بقای افسانه‌ای — هیچ‌وقت نمی‌میری!";
    case "apocalypse_now":
      botManager.opCommand("weather thunder");
      botManager.opCommand("time set midnight");
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        botManager.opCommand(`summon zombie ~${Math.round(Math.cos(a) * 8)} ~ ~${Math.round(Math.sin(a) * 8)}`);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.5;
        botManager.opCommand(`summon skeleton ~${Math.round(Math.cos(a) * 8)} ~ ~${Math.round(Math.sin(a) * 8)}`);
      }
      return "🌑 آخرالزمان آغاز شد — خدا نگهدارت!";
    case "peace_day":
      botManager.opCommand("gamerule doDaylightCycle false");
      botManager.opCommand("time set day");
      botManager.opCommand("weather clear");
      botManager.opCommand("difficulty peaceful");
      botManager.opCommand("gamerule doMobSpawning false");
      botManager.opCommand("kill @e[type=zombie]");
      botManager.opCommand("kill @e[type=skeleton]");
      botManager.opCommand("kill @e[type=creeper]");
      return "☮️ روز صلح — دنیا آرام و روشن شد.";
    case "night_raid":
      botManager.opCommand("time set midnight");
      botManager.opCommand("weather rain");
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        botManager.opCommand(`summon zombie ~${Math.round(Math.cos(a) * 7)} ~ ~${Math.round(Math.sin(a) * 7)}`);
      }
      return "🌙 یورش شبانه — دشمنان در تاریکی می‌آیند!";
    case "birthday_party":
      for (const off of ["~-3 ~2 ~", "~3 ~2 ~", "~ ~4 ~3"]) botManager.opCommand(`summon firework_rocket ${off} {FireworksItem:{id:"firework_rocket",Count:1,tag:{Explosions:[{Type:1b,Colors:[I;16711680,16776960,255]}]}}}`);
      botManager.opCommand("particle heart ~ ~2 ~ 3 2 3 0 50");
      botManager.opCommand("playsound entity.player.levelup master @a");
      botManager.opCommand(`title ${player} title {"text":"تولدت مبارک! 🎂","color":"gold"}`);
      return "🎂 پارتی تولد — قورت بده کیک رو!";
    case "victory_royale":
      botManager.opCommand(`title ${player} title {"text":"🏆 برنده شدی!","color":"gold"}`);
      botManager.opCommand("playsound entity.player.levelup master @a");
      for (const off of ["~-4 ~2 ~-4", "~4 ~2 ~-4", "~-4 ~2 ~4", "~4 ~2 ~4"]) botManager.opCommand(`summon firework_rocket ${off}`);
      botManager.opCommand("summon lightning_bolt ~6 ~ ~6");
      botManager.opCommand("summon lightning_bolt ~-6 ~ ~-6");
      return "🏆 پیروزی باشکوه — لایقش بودی!";
    case "arrow_rain":
      for (let i = 0; i < 6; i++) {
        botManager.opCommand(`summon arrow ~${(i % 3) - 1} ~15 ~${Math.floor(i / 3) - 1}`);
      }
      return "🏹 بارش تیر — پناه بگیر!";
    case "music_playlist":
      for (const s of ["entity.cat.purr", "entity.pig.ambient", "entity.cow.moo", "entity.chicken.ambient", "block.note_block.pling"]) {
        botManager.opCommand(`playsound ${s} master @a`);
        await new Promise((r) => setTimeout(r, 700));
      }
      return "🎵 پلی‌لیست اجرا شد!";
    case "house_op":
      botManager.opCommand("fill ~-3 ~-1 ~-3 ~3 ~3 ~3 oak_planks hollow");
      botManager.opCommand("fill ~-3 ~4 ~-3 ~3 ~4 ~3 oak_slab");
      botManager.opCommand("setblock ~ ~ ~ air");
      botManager.opCommand("setblock ~ ~1 ~ air");
      botManager.opCommand("setblock ~ ~ ~-3 air");
      return "🏠 خانهٔ ویلایی آماده است!";
    case "peak_logo_op":
      botManager.opCommand("fill ~ ~1 ~ ~ ~10 ~ white_concrete");
      botManager.opCommand("fill ~ ~10 ~ ~5 ~10 ~ white_concrete");
      botManager.opCommand("fill ~5 ~10 ~ ~5 ~5 ~ white_concrete");
      botManager.opCommand("fill ~ ~5 ~ ~5 ~5 ~ white_concrete");
      botManager.opCommand("fill ~-1 ~ ~-1 ~6 ~0 ~1 cyan_concrete");
      return "🅿️ لوگوی Peak ساخته شد!";
    case "dance_floor_op":
      botManager.opCommand("fill ~-4 ~-1 ~-4 ~4 ~-1 ~4 glowstone");
      botManager.opCommand("particle note ~ ~2 ~ 4 1 4 0 80");
      botManager.opCommand("playsound block.note_block.pling master @a");
      return "🪩 رقص‌گاه درخشان آماده است!";
    case "speedrun_kit":
      for (const c of [`give ${player} ender_pearl 16`, `give ${player} netherite_pickaxe 1`, `give ${player} cooked_beef 32`, `give ${player} red_bed 1`, `give ${player} water_bucket 1`]) botManager.opCommand(c);
      return "🏁 کیت اسپیدران — رکورد بزن!";
    case "fishing_mania":
      botManager.opCommand(`give ${player} fishing_rod 1`);
      botManager.opCommand(`effect give ${player} luck 999 2`);
      botManager.opCommand(`effect give ${player} haste 999 1`);
      botManager.opCommand(`effect give ${player} water_breathing 999 0`);
      return "🎣 ماهیگیری دیوانه — قلاب پر ماهی!";

    default:
      return cap.label + " — انجام شد.";
  }
}

/* ------------------------------------------------------------------ */
/* مچ سریع جمله‌های فارسی (بدون LLM)                                     */
/* ------------------------------------------------------------------ */

interface FastPattern {
  re: RegExp;
  /** شناسهٔ ثابت یا محاسبه‌شده از روی جمله */
  id: string | ((m: RegExpMatchArray) => string);
  args?: (m: RegExpMatchArray) => Record<string, string>;
}

/* نگاشت نام‌های فارسی ماب‌ها → شناسهٔ ماینکرفت */
export const MOB_MAP: Record<string, string> = {
  زامبی: "zombie", اسکلت: "skeleton", کریپر: "creeper", اندرمن: "enderman",
  عنکبوت: "spider", جادوگر: "witch", اسلایم: "slime", فانتوم: "phantom",
  پیلیجر: "pillager", ویندیکیتور: "vindicator", راویجر: "ravager", گست: "ghast",
  بلیز: "blaze", گاردین: "guardian", شالکر: "shulker", وکس: "vex",
  مگما: "magma_cube", خفاش: "bat", طوطی: "parrot", گرگ: "wolf", سگ: "wolf",
  گربه: "cat", اسب: "horse", گاو: "cow", خوک: "pig", گوسفند: "sheep",
  مرغ: "chicken", ویلیجر: "villager", گولم: "iron_golem", زنبور: "bee",
  روباه: "fox", "لاک‌پشت": "turtle", آکسلوتل: "axolotl", قورباغه: "frog",
  الی: "allay", ویزر: "wither", اژدها: "ender_dragon"
};

/* نگاشت نام‌های فارسی آیتم‌ها → شناسه */
export const ITEM_MAP: Record<string, string> = {
  الماس: "diamond", آهن: "iron_ingot", طلا: "gold_ingot", ندریت: "netherite_ingot",
  سنگ: "stone", خاک: "dirt", چوب: "oak_planks", شیشه: "glass", آجر: "bricks",
  سیب: "apple", نان: "bread", استیک: "cooked_beef", تیر: "arrow", مشعل: "torch",
  شمشیر: "iron_sword", کلنگ: "iron_pickaxe", تبر: "iron_axe", "چکمه": "iron_boots",
  "سیب طلایی": "golden_apple", مروارید: "ender_pearl", تاتم: "totem_of_undying",
  فشفشه: "firework_rocket", اکسیر: "potion", زره: "iron_chestplate", گندم: "wheat"
};

/* نگاشت نام‌های فارسی افکت‌ها → شناسه */
export const EFFECT_MAP: Record<string, string> = {
  سرعت: "speed", قدرت: "strength", عجله: "haste", جذب: "absorption",
  مقاومت: "resistance", نامرئی: "invisibility", شناوری: "levitation",
  "سقوط آهسته": "slow_falling", سیری: "saturation", شانس: "luck",
  سلامتی: "instant_health", درخشش: "glowing", "قهرمان": "hero_of_the_village"
};

/** تبدیل نام فارسی ماب/آیتم/افکت به شناسه */
function mapName(raw: string, map: Record<string, string>): string {
  const t = raw.trim().toLowerCase();
  return map[t] ?? map[t.replace(/‌/g, " ")] ?? t.replace(/\s+/g, "_");
}

const MOB_NAMES_RE = Object.keys(MOB_MAP).join("|");
const EFFECT_NAMES_RE = Object.keys(EFFECT_MAP).join("|");

const FAST_PATTERNS: FastPattern[] = [
  // ═══ اصلاحات دیباگ — الگوهایی که نمونه‌های خودشان را نمی‌گرفتند ═══
  // شعاع اسکن باید قبل از «اسکن»ِ عمومی باشد تا «اسکن ۱۰۰۰ بلوکی» را ندزدد
  { re: /(اسکن\s*(?:۱۰۰۰|1000)(?:\s*بلوکی?)?|شعاع\s*اسکن|کمربند\s*اسکن)/i, id: "scan_radius", args: (m) => ({ n: /۱۰۰۰|1000/.test(m[0]) ? "1000" : (m[1]?.match(/\d+/)?.[0] ?? "1000") }) },
  { re: /(اسکن\s*کن(?:ید)?|اسکن(?:\s*محیط)?|خطری\s*هست|خطر\s*رو\s*اسکن)/i, id: "danger_scan" },
  // ساعت بازی (نه ساعت واقعی — آن را مغز آفلاین جواب می‌دهد)
  { re: /(ساعت\s*بازی|الان\s*توی?\s*بازی\s*چنده|بازی\s*روزه\s*یا\s*شب)/i, id: "world_ticks" },
  { re: /(صد\s*بلوک\s*(?:ببر|برو)\s*بالا|(?:ببر|برو)\s*بالا\s*(?:۱۰۰|100)|(?:۱۰۰|100)\s*بلوک\s*(?:ببر|برو)?\s*بالا)/i, id: "tp_up_100" },
  // پت‌های شخصی (نگهبان «گرگ منو بکش» نباید بگیردشان)
  { re: /(گرگ\s*من(?!و)|سگ\s*من(?!و)|گرگمو|سگمو|پت\s*گرگ)/i, id: "my_wolf" },
  { re: /(گربه\s*من(?!و)|گربمو|پت\s*گربه)/i, id: "my_cat" },
  // ساخت و ساز — نمونه‌های بدون الگو
  { re: /(اینجا\s*(?:یه\s*)?بلوک\s*بذار(?:ید)?|یه\s*بلوک\s*بذار(?:ید)?)/i, id: "place_block" },
  { re: /(اینجا\s*(\S{2,12})\s*بذار(?:ید)?)/i, id: "setblock", args: (m) => ({ item: m[2] }) },
  { re: /(اینجا\s*رو\s*خالی\s*کن(?:ید)?|محوطه\s*رو\s*(?:صاف|خالی)\s*کن(?:ید)?|اینجا\s*رو\s*صاف\s*کن(?:ید)?)/i, id: "clear_area" },
  { re: /(این\s*سازه\s*رو\s*کپی\s*کن(?:ید)?|کپی\s*سازه|سازه\s*رو\s*کپی)/i, id: "clone_area" },
  { re: /(ردیف\s*مشعل|مشعل\s*ردیفی)/i, id: "torch_line" },
  { re: /(برج\s*بساز(?:ید)?)/i, id: "build_tower" },
  { re: /(دیوار\s*بساز(?:ید)?|یه\s*دیوار\s*بساز)/i, id: "build_wall" },
  { re: /(مکعب\s*بساز(?:ید)?)/i, id: "build_cube" },
  { re: /(سکو\s*بساز(?:ید)?|سکویی\s*بساز)/i, id: "build_platform" },
  // خانهٔ ساده — بعد از «خانه ویلایی/ویلا» (که پایین‌ترند) گیر نمی‌کند چون «بساز» بلافاصله می‌آید
  { re: /(خونه\s*بساز(?:ید)?|خانه\s*بساز(?:ید)?|یه\s*خونه\s*ساده)/i, id: "house" },
  // آیتم با تعداد: «۵ الماس بده» / «یه الماس بده» (ارقام با نرمال‌سازی انگلیسی می‌شوند)
  { re: /(?:^|[\s،,])(?:یه|یک|\d+)\s*(\S{2,12})\s*بده/i, id: "give_item", args: (m) => ({ item: m[1], n: "1" }) },
  // دوست با ترتیب کلمهٔ «دوستم علی» (نه «X رو دوستم حساب کن» که پایین‌تر است)
  { re: /دوستم\s*(?!حساب|نیست)(\S{2,16})/i, id: "friend_add", args: (m) => ({ player: (m[1] || "").trim() }) },

  // تلپورت و آمدن
  { re: /(بیا\s*پیش\s*من|بیام\s*پیشت|تلپورت\s*کن\s*پیش\s*من|tp\s*پیش\s*من|بیا\s*پیشم\s*الان)/i, id: "tp_to_me" },
  { re: /(بیا\s*پیشم|بیا\s*اینجا|بیا\s*پیش\s*من(?!\s*تلپورت)|come\s*here|بیام\s*پیش\s*تو)/i, id: "come" },
  { re: /(بیا\s*دنبالم|منو\s*دنبال\s*کن|دنبالم\s*بیا|دنبالم\s*کن|follow\s*me)/i, id: "follow" },
  { re: /(وایسا|ایست|توقف|stop\s+now|stop)/i, id: "stop" },
  { re: /(?:برو\s*به|تلپورت\s*به)\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)/i, id: "goto", args: (m) => ({ x: m[1], y: m[2], z: m[3] }) },
  { re: /(ببر\s*بالا|برو\s*آسمون|ببر\s*هوا)/i, id: "tp_up" },
  { re: /(قایم\s*شو|پنهان\s*شو|مخفی\s*شو)/i, id: "hide" },
  { re: /(برگرد(?!\s*سر\s*جات)(?:\s*(?:به\s*)?جای\s*قبلی|\s*عقب)?|به\s*جای\s*قبلی\s*برگرد|بیا\s*برگرد|bargard|back\s*to\s*previous)/i, id: "go_back" },
  { re: /(اینجا\s*رو\s*یاد(?:\s*ش)?\s*کن|این\s*مکان\s*رو\s*یاد(?:\s*ش)?\s*کن|اینجا\s*رو\s*نشانه\s*گذاری\s*کن|save\s*spot|mark\s*here)/i, id: "mark_here" },

  // زمان و هوا
  { re: /(روز\s*کن|صبحش\s*کن|روشن\s*ش\s*کن|هوا\s*روشن)/i, id: "time_day" },
  { re: /(شب\s*کن|تاریکش\s*کن|شب\s*بشه)/i, id: "time_night" },
  { re: /(بارون\s*بند|هوا\s*صاف|صافش\s*کن)/i, id: "weather_clear" },
  { re: /(بارون\s*بیار|بارونی\s*ش\s*کن)/i, id: "weather_rain" },
  { re: /(طوفان\s*بیار|رعد\s*و\s*برق)/i, id: "weather_thunder" },

  // گیم‌مود
  { re: /(کریتیو|خلاقانه|حالت\s*خلاق)/i, id: "gamemode_creative" },
  { re: /(سروایول|بقا\s*شو|حالت\s*بقا)/i, id: "gamemode_survival" },
  { re: /(تماشاگر|اسپکتیتور)/i, id: "gamemode_spectator" },
  { re: /(پرواز\s*کن|پروازی\s*شو|فلای)/i, id: "fly" },

  // سلامت و افکت
  { re: /(سلامتیم\s*رو\s*پر\s*کن|هیلم\s*کن|پر\s*کن\s*سلامتی)/i, id: "heal" },
  { re: /(سیرم\s*کن|گشنمه|گرسنگی)/i, id: "feed" },
  { re: /(سریع\s*شو|افکت\s*سرعت|speed)/i, id: "effect_speed" },
  { re: /(قوی\s*شو|افکت\s*قدرت|strength)/i, id: "effect_strength" },
  { re: /(دید\s*در\s*شب|شب\s*بین\s*شو)/i, id: "effect_night" },
  { re: /(افکتا\s*رو\s*پاک\s*کن|افکت\s*پاک)/i, id: "clear_effects" },

  // آیتم
  { re: /(?:به(?:م|مان)?|برای(?:م|مان)?)\s*(?:یه|یک)?\s*(\S{2,12})\s*بده/i, id: "give_item", args: (m) => ({ item: m[1], n: "1" }) },
  { re: /(\d+)\s*(?:تا|عدد)?\s*(\S{2,12})\s*بده/i, id: "give_item", args: (m) => ({ item: m[2], n: m[1] }) },

  // نبرد
  { re: /(محافظت\s*کن|حفاظت\s*کن|حفاظتم\s*کن|حالت\s*پلیس|محافظم\s*باش|حفاظتم\s*کن)/i, id: "guard_on" },
  { re: /(محافظت\s*خاموش|دست\s*از\s*محافظت)/i, id: "guard_off" },
  { re: /(اتوکلیک|حمله\s*خودکار\s*روشن)/i, id: "autoattack_on" },
  { re: /(حمله\s*خودکار\s*خاموش|اتوکلیک\s*خاموش)/i, id: "autoattack_off" },
  { re: /(بزن\s*بکشش|حمله\s*کن|بکشش)/i, id: "attack_nearest" },
  { re: /(فرار\s*کن|در\s*برو|فقط\s*بدو)/i, id: "flee" },
  { re: /(مابا\s*رو\s*بکش|همه\s*مابا|ماب‌ها\s*رو\s*پاک)/i, id: "kill_all_mobs" },

  // جمع‌آوری
  { re: /([\u0600-\u06FFa-z_]{2,14})\s*(?:ها)?\s*(?:رو)?\s*جمع\s*کن/i, id: "collect_block", args: (m) => ({ item: m[1] }) },
  { re: /(درخت\s*ببر|درختا\s*رو\s*ببر)/i, id: "chop_trees" },
  { re: /(همه\s*چی\s*رو\s*جمع\s*کن|جمع\s*کن\s*همه)/i, id: "collect_all" },

  // اطلاعات
  // جهت نگاه — باید قبل از «کجایی» باشد تا با coords قاطی نشود
  { re: /(جهت\s*(?:نگاه|نگاهت)|رو\s*به\s*کجایی|کدوم\s*طرفی|کدوم\s*سمتی)/i, id: "facing_direction" },
  { re: /(کجایی|مختصاتت|کجای\s*نقشه)/i, id: "coords" },
  { re: /(وضعیت|گزارش\s*بده|چه\s*خبر)/i, id: "status" },
  { re: /(کیا\s*آنلاینن|کیا\s*هستن|بازیکنان)/i, id: "players_online" },
  { re: /(چند\s*جون\s*داری|سلامتیت)/i, id: "health_report" },

  // چت و سرگرمی
  { re: /(?:تو|در)\s*چت\s*بگو\s+(.+)/i, id: "say", args: (m) => ({ text: m[1].trim() }) },
  { re: /(برقص|رقصیدن)/i, id: "dance" },
  { re: /(بخچر|بخوچر|بچرخ)/i, id: "spin" },
  { re: /(دست\s*تکون\s*بده|سلام\s*کن)/i, id: "wave" },
  { re: /(جشن\s*بگیر|پارتی)/i, id: "party" },

  // حالت‌های شخصیتی + وود پمپ + فینگیلیش
  { re: /(وود\s*پمپ|vood\s*pump|god\s*mode|عصبانی\s*شو|خشمگین\s*شو|حالت\s*خشم|حالت\s*عصبانی|بجنگ\s*الان)/i, id: "personality_angry" },
  { re: /(مهربون\s*شو|مهربان\s*شو|حالت\s*مهربون|مهربانی\s*کن|آروم\s*باش)/i, id: "personality_kind" },
  { re: /(عادی\s*شو|حالت\s*عادی|حالت\s*معمولی|حالت\s*نرمال|normal\s*mode)/i, id: "personality_normal" },
  { re: /(سرعت\s*موشکی|سرعتت\s*رو\s*زیاد\s*کن|سرعتت\s*زیاد|تیپی\s*سرعت|speed\s*boost)/i, id: "speed_tp_on" },
  { re: /(سرعت\s*خاموش|سرعت\s*عادی|آروم\s*حرکت\s*کن)/i, id: "speed_tp_off" },
  // احضار ماب (با نام فارسی) — قبل از الگوهای عمومی تا اشتباه گرفته نشود
  { re: new RegExp(`(${MOB_NAMES_RE})\\s*(?:رو)?\\s*(?:احضار\\s*کن|بیارش?|بساز\\s*اینجا)`, "i"),
    id: (m) => `summon_${mapName(m[1], MOB_MAP)}`, args: (m) => ({ mob: mapName(m[1], MOB_MAP) }) },
  // کشتن یک نوع ماب مشخص
  { re: new RegExp(`(${MOB_NAMES_RE})\\s*(?:ها)?\\s*(?:رو)?\\s*بکش`, "i"),
    id: "kill_mob_type", args: (m) => ({ mob: mapName(m[1], MOB_MAP) }) },
  // افکت‌ها
  { re: new RegExp(`(?:افکت\\s*)?(${EFFECT_NAMES_RE})\\s*(?:رو)?\\s*(?:بهم\\s*)?بده`, "i"),
    id: (m) => `effect_${mapName(m[1], EFFECT_MAP)}`, args: (m) => ({ effect: mapName(m[1], EFFECT_MAP) }) },
  // دادن آیتم با نام فارسی + تعداد
  { re: /به\s*(\S{2,16})\s*(?:(\d+|[\u06F0-\u06F9]+)\s*تا)?\s*«?([\u0600-\u06FF\s]{2,24})»?\s*بده/i,
    id: (m) => (ITEM_MAP[m[3].trim()] === "diamond" ? "give_diamond" : "give_any"),
    args: (m) => ({ player: m[1], n: m[2] ? toEnglishDigits(m[2]) : "1", item: mapName(m[3], ITEM_MAP) }) },
  { re: /(\d+|[\u06F0-\u06F9]+)\s*تا\s*«?([\u0600-\u06FF\s]{2,24})»?\s*بده/i,
    id: "give_any",
    args: (m) => ({ n: toEnglishDigits(m[1]), item: mapName(m[2], ITEM_MAP) }) },
  // «الماس بده» بدون گیرنده — بعد از «به فلانی الماس بده» و بدون دزدیدن «۵ الماس بده»
  { re: /(?<![\d۰-۹]\s)الماس\s*بده(?:ید)?/i, id: "give_diamond" },
  // توانایی‌های اطلاعاتی جدید (صوتی)
  { re: /(پینگت\s*چنده|لگ\s*داری)/i, id: "ping_report" },
  { re: /(دستت\s*چیه|چی\s*دستته|چی\s*تو\s*دستته)/i, id: "held_item" },
  { re: /(چند\s*تا\s*(خصم|دشمن)|دشمن\s*اطراف)/i, id: "mob_count" },
  { re: /(کیا\s*اطرافن|چه\s*موجوداتی\s*اینجان|کیا\s*اینجان)/i, id: "nearby_entities" },
  { re: /(سرعتت\s*چنده|سرعت\s*فعلیت\s*چنده)/i, id: "speed_report" },
  { re: /(زره[‌ ]?ت\s*چیه|وضعیت\s*زره)/i, id: "armor_status" },
  { re: /(زیر\s*پات\s*چیه)/i, id: "block_at_feet" },
  { re: /(الان\s*تو\s*بازی\s*چنده|الان\s*تو\s*بازی\s*روزه\s*یا\s*شب|تو\s*بازی\s*روزه\s*یا\s*شب)/i, id: "world_ticks" },
  // تلپورت‌ها و جهت‌ها
  { re: /(صد\s*بلوک\s*(?:ببر|برو)\s*بالا|(?:ببر|برو)\s*بالا\s*(?:۱۰۰|100)|(?:۱۰۰|100)\s*بلوک\s*(?:ببر|برو)?\s*بالا)/i, id: "tp_up_100" },
  { re: /(ببر\s*پایین)/i, id: "tp_down_50" },
  { re: /(ببر\s*شمال)/i, id: "tp_north" },
  { re: /(ببر\s*جنوب)/i, id: "tp_south" },
  { re: /(ببر\s*شرق)/i, id: "tp_east" },
  { re: /(ببر\s*غرب)/i, id: "tp_west" },
  { re: /(ببر\s*اسپاون|بریم\s*اسپاون)/i, id: "tp_to_spawn" },
  // جهان و سرور
  { re: /(صاعقه\s*بزن|رعد\s*بیار)/i, id: "lightning_strike" },
  { re: /(تی[‌ ]?ان[‌ ]?تی\s*(بذار|بزن)|بمب\s*بذار)/i, id: "tnt_at" },
  { re: /(بازی\s*رو\s*(ذخیره|سیو)\s*کن|سیو\s*کن)/i, id: "save_world" },
  { re: /(آیتم(?:های)?\s*(?:روی)?\s*زمین\s*رو\s*پاک\s*کن|زمین\s*رو\s*تمیز\s*کن)/i, id: "kill_items" },
  { re: /(تیرها\s*رو\s*پاک\s*کن)/i, id: "kill_arrows" },
  // حرکت پیشرفته
  { re: /(برو\s*جلو|جلو\s*برو)/i, id: "walk_forward" },
  { re: /(بچرخ\s*چپ)/i, id: "turn_left" },
  { re: /(بچرخ\s*راست)/i, id: "turn_right" },
  { re: /(آسمون\s*رو\s*نگاه\s*کن)/i, id: "look_sky" },
  { re: /(زمین\s*رو\s*نگاه\s*کن)/i, id: "look_ground" },
  { re: /(سر\s*تکون\s*بده|آره\s*بگو\s*با\s*سرت)/i, id: "nod" },
  { re: /(نه\s*بگو\s*با\s*سرت)/i, id: "shake_head" },
  { re: /(\d+|[\u06F0-\u06F9]+)?\s*بار\s*بپر|پشت\s*سر\s*هم\s*بپر/i, id: "jump_n",
    args: (m) => ({ n: m[1] ? toEnglishDigits(m[1]) : "3" }) },
  { re: /(یهو\s*بدو|اسپرینت\s*کن)/i, id: "sprint_burst" },
  { re: /(جاخالی\s*چپ)/i, id: "dodge_left" },
  { re: /(جاخالی\s*راست)/i, id: "dodge_right" },
  { re: /(خوشحالی\s*کن|شادی\s*کن)/i, id: "happy_jump" },
  // نبرد پیشرفته
  { re: /(به\s*خصم\s*حمله\s*کن|ماب\s*رو\s*بزن)/i, id: "attack_hostile" },
  { re: /(ضربه\s*ویژه\s*بزن|کریتیکال)/i, id: "crit_attack" },
  { re: /(پشت\s*سر\s*هم\s*بزن|ضربه\s*سریع)/i, id: "rapid_attack" },
  { re: /(مسخره[‌ ]?ش\s*کن|دشمن\s*رو\s*تیکه\s*بنداز)/i, id: "taunt" },
  { re: /(مروارید\s*بنداز|اندروپرته?)/i, id: "throw_pearl" },
  { re: /(گوله\s*برف\s*بنداز)/i, id: "throw_snowball" },
  { re: /(تخم[‌ ]?مرغ\s*بنداز)/i, id: "throw_egg" },
  { re: /(سپر\s*بگیر|سپر\s*رو\s*بردار)/i, id: "equip_shield" },
  { re: /(دست\s*بزن|کف\s*بزن)/i, id: "clap" },
  // بقا و تعامل
  { re: /(غذا\s*بخور|گشنمه|الان\s*بخور)/i, id: "eat_now" },
  { re: /(اکسیر\s*(بخور|بنوش))/i, id: "drink_potion" },
  { re: /(بریم\s*بخوابیم|الان\s*بخواب)/i, id: "sleep_now" },
  { re: /(بیدار\s*شو|پاشو\s*بیدارشو)/i, id: "wake_up" },
  { re: /(ماهیگیری\s*کن|قلاب\s*بنداز)/i, id: "fish_start" },
  { re: /(قلاب\s*رو\s*جمع\s*کن)/i, id: "fish_stop" },
  { re: /(سوار\s*شو|بشین\s*روش)/i, id: "mount_nearest" },
  { re: /(پیاده\s*شو|بیا\s*پایین\s*ازش)/i, id: "dismount_now" },
  { re: /(در\s*رو\s*باز\s*کن)/i, id: "open_door" },
  { re: /(زنگ\s*رو\s*بزن)/i, id: "ring_bell" },
  { re: /(دکمه\s*رو\s*بزن|اهرم\s*رو\s*بکش)/i, id: "press_button" },
  { re: /(آتش\s*رو\s*روشن\s*کن)/i, id: "light_campfire" },
  { re: /(آتش\s*رو\s*خاموش\s*کن)/i, id: "extinguish_campfire" },
  { re: /(پشم\s*بچین|گوسفند\s*رو\s*بچین)/i, id: "shear_sheep" },
  { re: /(شیر\s*بدوش)/i, id: "milk_cow" },
  { re: /(حیوانات\s*رو\s*تکثیر\s*کن|جفت[‌ ]?گیری)/i, id: "breed_animals" },
  { re: /(مشعل\s*بذار)/i, id: "place_torch_feet" },
  // کوله‌بار
  { re: /(اینو\s*بنداز|دستت\s*رو\s*خالی\s*کن)/i, id: "toss_stack" },
  { re: /(همه\s*چی(زا)?\s*رو\s*بریز|کوله[‌ ]?بار\s*رو\s*خالی\s*کن)/i, id: "toss_all" },
  { re: /«?([\u0600-\u06FFa-z_]{2,20})»?\s*رو\s*دستت\s*بگیر/i, id: "hold_item",
    args: (m) => ({ item: mapName(m[1], ITEM_MAP) }) },
  { re: /(زره\s*بپوش|تجهیز\s*شو)/i, id: "armor_best" },
  { re: /(دست[‌ ]?هات\s*رو\s*عوض\s*کن)/i, id: "swap_hands" },
  { re: /(کوله[‌ ]?بار\s*رو\s*تمیز\s*کن|آشغال[‌ ]?ها\s*رو\s*بریز)/i, id: "clean_inventory" },
  { re: /(تاتم\s*رو\s*دستت\s*بگیر)/i, id: "refill_totem" },
  { re: /(تونل\s*(بزن|بکن))/i, id: "dig_tunnel", args: () => ({ n: "5" }) },
  { re: /(چاه\s*(بزن|بکن))/i, id: "dig_shaft", args: () => ({ n: "5" }) },
  // سرگرمی و حالت‌ها
  { re: /(آواز\s*بخون|بخون\s*برام)/i, id: "sing_chat" },
  { re: /(جوک\s*بگو\s*تو\s*چت)/i, id: "tell_joke_chat" },
  { re: /(شمارش\s*معکوس|سه\s*دو\s*یک)/i, id: "count_down" },
  { re: /(غرش\s*کن|شیر\s*شو)/i, id: "roar" },
  { re: /(یخ\s*بزن|فریز\s*کن)/i, id: "freeze" },
  { re: /(آب\s*شو|فریز\s*رو\s*بردار)/i, id: "unfreeze" },
  { re: /(اسلات|خانه)\s*(\d+|[\u06F0-\u06F9]+)/i, id: "select_slot",
    args: (m) => ({ n: toEnglishDigits(m[2]) }) },

  // ═══ سطح خدا ═══
  // مهروموم خدایی (Divine Seal) — زیرمجموعهٔ سطح خدا؛ الگوهای «باز/بردار» قبل از «اجرا» تا گم‌نشوند
  { re: /مهروموم(?:\s*خدایی)?\s+(?:روی\s+)?(\S{2,16})\s+رو\s+(?:بردار(?:ید)?|باز\s*کن(?:ید)?|لغو\s*کن(?:ید)?|خاموش(?:\s*کن(?:ید)?)?|قطع\s*کن(?:ید)?)/i, id: "god_seal_off", args: (m) => ({ player: (m[1] || "").trim() }) },
  { re: /مهروموم(?:\u200cها|\u200cهای)?(?:\s*خدایی)?\s*(?:رو|را)?\s*(?:بردار(?:ید)?|باز\s*کن(?:ید)?|لغو\s*کن(?:ید)?|خاموش(?:\s*کن(?:ید)?)?|قطع\s*کن(?:ید)?)|divine\s*seal\s*off|مهروموم\s*لغو|باز\s*کردن\s*مهروموم/i, id: "god_seal_off" },
  { re: /مهروموم(?:\s*خدایی)?(?:\s+(?:بزن(?:ید)?|اجرا\s*کن(?:ید)?|فعال(?:\s*کن(?:ید)?)?))?(?:\s+(?:روی|برای))?(\s+\S{2,16})?|divine\s*seal(?:\s+on)?(?:\s+(\S{2,16}))?|قفل\s*خدایی(?:\s+(?:بزن(?:ید)?|اجرا\s*کن(?:ید)?))?(?:\s+روی)?(\s+\S{2,16})?/i, id: "god_seal_on", args: (m) => ({ player: (m[1] || m[2] || m[3] || "").trim() }) },
  { re: /نبرد\s*خدایی(?:\s+روی)?(\s+\S{2,16})?|جنگ\s*خدایی(?:\s+روی)?(\s+\S{2,16})?|پی\s*وی\s*پی(?:\s+روی)?(\s+\S{2,16})?|god\s*pvp(?:\s+(\S{2,16}))?/i, id: "god_pvp", args: (m) => ({ player: (m[1] || m[2] || m[3] || m[4] || "").trim() }) },
  { re: /(حالت\s*خدا\s*(روشن|فعال)|خدایی\s*شو|god\s*mode\s*on)/i, id: "god_mode_on" },
  { re: /(حالت\s*خدا\s*(خاموش|قطع)|god\s*mode\s*off)/i, id: "god_mode_off" },
  { re: /(شفای\s*(مطلق|خدا)|سلامتی\s*خدا)/i, id: "god_heal" },
  { re: /(کیت\s*خدا|تجهیزات\s*خدا)/i, id: "god_kit" },
  { re: /(مشت\s*یک\s*ضربه|one\s*punch)/i, id: "one_punch" },
  { re: /(جان\s*(ابدی|خدا)|نامیرا\s*شو)/i, id: "god_health" },
  { re: /(سرعت\s*خدا)/i, id: "god_speed" },
  { re: /(پرش\s*خدا)/i, id: "god_jump" },
  { re: /(دید\s*خدا|دیواربین\s*شو)/i, id: "god_vision" },
  { re: /(قدرت\s*خدا)/i, id: "god_strength" },
  { re: /(نامرئی\s*(مطلق|خدا)|غیب\s*شو)/i, id: "god_vanish" },
  { re: /(قلعه\s*(بزرگ\s*)?بساز|قلعه\s*عظیم)/i, id: "castle_op" },
  { re: /(هرم\s*(عظیم|بزرگ)\s*بساز)/i, id: "pyramid_mega" },
  { re: /(ورزشگاه\s*بساز)/i, id: "stadium_op" },
  { re: /(پل\s*(طولانی\s*)?بساز)/i, id: "bridge_long_op" },
  { re: /(دیوار\s*(بزرگ|دفاعی)\s*بساز)/i, id: "wall_long_op" },
  { re: /(دریاچه\s*بساز)/i, id: "lake_op" },
  { re: /(کوه\s*بساز)/i, id: "mountain_op" },
  { re: /(جزیره\s*بساز)/i, id: "island_op" },
  { re: /(قلب\s*(پیکسلی\s*)?بساز)/i, id: "pixel_heart_op" },
  { re: /(خندق\s*(بکن|بساز))/i, id: "trench_op" },
  { re: /(آرنا\s*بساز|میدان\s*نبرد\s*بساز)/i, id: "arena_op" },
  { re: /(مزرعه\s*بساز)/i, id: "farm_op" },
  { re: /(کف\s*طلایی|طبقه\s*طلایی)/i, id: "gold_floor_op" },
  { re: /(دشت\s*برفی|برفیش\s*کن)/i, id: "snow_field_op" },
  { re: /(شهاب\s*سنگ\s*(ببار|بزن)|شلیک\s*شهاب)/i, id: "meteor_strike" },
  { re: /(بمب\s*اتمی|ناحیه\s*رو\s*نابود\s*کن)/i, id: "nuke_area" },
  { re: /(آخرالزمان\s*زامبی|ارتش\s*زامبی)/i, id: "zombie_apocalypse" },
  { re: /(طوفان\s*ویزر|سه\s*تا\s*ویزر)/i, id: "wither_storm" },
  { re: /(طوفان\s*رعد|تاریک\s*و\s*طوفانی)/i, id: "thunderstorm_op" },
  { re: /(ماب[‌ ]?ها\s*رو\s*یخ\s*بزن)/i, id: "freeze_mobs" },
  { re: /(روز\s*ابدی|دیگه\s*شب\s*نشه)/i, id: "daylight_forever" },
  { re: /(صلح\s*ابدی|دیگه\s*ماب\s*نیاد)/i, id: "peaceful_forever" },
  { re: /(ایست\s*زمان|زمان\s*متوقف)/i, id: "time_stop" },
  { re: /(زمان\s*ادامه|همه\s*چیز?\s*عادی\s*شه)/i, id: "time_resume" },
  { re: /(به\s*ندر\s*برو|بریم\s*ندر)/i, id: "tp_nether" },
  { re: /(به\s*اند\s*برو|بریم\s*اند)/i, id: "tp_end" },
  { re: /(برگرد\s*دنیای\s*معمولی|بیا\s*اورورلد)/i, id: "tp_overworld" },
  { re: /(فرود\s*ابرقهرمانی|پرواز\s*و\s*فرود)/i, id: "super_hero_landing" },
  { re: /(غرش\s*خدا|ورود\s*باشکوه)/i, id: "god_roar" },
  { re: /(پارتی\s*دیسکو|جشن\s*خدایی)/i, id: "disco_party" },

  // ═══ ویژه — باس، حیوانات، نمایش، کیت، چالش ═══
  { re: /(باس\s*زامبی|رئیس\s*زامبی)/i, id: "boss_zombie" },
  { re: /(باس\s*اسکلت|رئیس\s*اسکلت)/i, id: "boss_skeleton" },
  { re: /(کریپر\s*(شارژی|برقی))/i, id: "boss_creeper" },
  { re: /(اژدهای\s*من|اژدهای\s*سفارشی)/i, id: "named_dragon" },
  { re: /(ارتش\s*سگ|سگ[‌ ]?های\s*نگهبان)/i, id: "pet_wolf_army" },
  { re: /(گربه[‌ ]?های\s*من|ارتش\s*گربه)/i, id: "pet_cats" },
  { re: /(گوسفند(?:های)?\s*رنگین\s*کمان|گوسفند\s*رنگی)/i, id: "rainbow_sheep" },
  { re: /(باغ\s*وحش\s*نوزاد|حیوان\s*بچه)/i, id: "baby_zoo" },
  { re: /(حلقه\s*کریستال|کریستال\s*اند)/i, id: "ender_crystal_ring" },
  { re: /(نمایش\s*آتش\s*بازی|آتیش\s*بازی|آتش\s*بازی\s*(کن|بده))/i, id: "firework_show" },
  { re: /(بارش\s*الماس|الماس\s*ببار)/i, id: "diamond_rain" },
  { re: /(بارش\s*تجربه|اکس\s*پی\s*ببار)/i, id: "xp_rain" },
  { re: /(حلقه\s*صاعقه|صاعقه\s*حلقه[‌ ]?ای)/i, id: "lightning_ring" },
  { re: /(ستون\s*نور|بیکن\s*بساز)/i, id: "beacon_beam" },
  { re: /(آبشار\s*بساز)/i, id: "waterfall_op" },
  { re: /(گنبد\s*شیشه[‌ ]?ای)/i, id: "glass_dome_op" },
  { re: /(پایگاه\s*آسمانی|سکوی\s*آسمانی)/i, id: "sky_base_op" },
  { re: /(تونل\s*شیشه[‌ ]?ای)/i, id: "glass_tunnel_op" },
  { re: /(برج\s*دیدبانی)/i, id: "watchtower_op" },
  { re: /(اسکله\s*بساز)/i, id: "fishing_dock_op" },
  { re: /(میدان\s*تیراندازی)/i, id: "target_range" },
  { re: /(حلقه\s*سومو)/i, id: "sumo_ring_op" },
  { re: /(پارکور\s*بساز|مسیر\s*پارکور)/i, id: "parkour_course" },
  { re: /(هزارتو\s*بساز)/i, id: "maze_op" },
  { re: /(کیت\s*معدنچی)/i, id: "miner_pack" },
  { re: /(کیت\s*سازنده)/i, id: "builder_pack" },
  { re: /(کیت\s*جنگجو)/i, id: "warrior_pack" },
  { re: /(کیت\s*کشاورز)/i, id: "farmer_pack" },
  { re: /(کیت\s*کاوشگر)/i, id: "explorer_pack" },
  { re: /(موج\s*دشمن|چالش\s*بده)/i, id: "challenge_wave" },
  { re: /(رالی\s*باس|همه\s*باس[‌ ]?ها)/i, id: "boss_rush" },
  { re: /(باران\s*سخت)/i, id: "hard_rain_op" },
  { re: /(شنای\s*شبانه|غواص\s*شو)/i, id: "night_swim" },
  { re: /(فرود\s*امن)/i, id: "safe_landing_op" },
  { re: /(لنگر\s*خانه|خونه\s*اینجا)/i, id: "home_anchor_op" },
  { re: /(سازنده\s*سریع)/i, id: "speed_builder" },

  // ═══ خفن — کمبوها، نمایش‌ها، سازه‌ها ═══
  { re: /(جنگجوی\s*افسانه[‌ ]?ای|ترکیب\s*جنگ)/i, id: "ultimate_warrior" },
  { re: /(سازنده\s*افسانه[‌ ]?ای|ترکیب\s*ساخت)/i, id: "ultimate_builder" },
  { re: /(بقای\s*افسانه[‌ ]?ای|ترکیب\s*بقا)/i, id: "ultimate_survivor" },
  { re: /(آخرالزمان\s*واقعی|آخرالزمان\s*شروع)/i, id: "apocalypse_now" },
  { re: /(روز\s*صلح|همه\s*چیز?\s*صلح)/i, id: "peace_day" },
  { re: /(یورش\s*شبانه|شبیخون)/i, id: "night_raid" },
  { re: /(پارتی\s*تولد|تولد\s*مبارک)/i, id: "birthday_party" },
  { re: /(پیروزی\s*باشکوه|جشن\s*پیروزی)/i, id: "victory_royale" },
  { re: /(بارش\s*تیر|تیر\s*ببار)/i, id: "arrow_rain" },
  { re: /(پخش\s*موسیقی|آهنگ\s*بذار)/i, id: "music_playlist" },
  { re: /(جاده\s*یخی)/i, id: "ice_road_op" },
  { re: /(خانه\s*ویلایی|ویلا\s*بساز)/i, id: "house_op" },
  { re: /(کلیسا\s*بساز)/i, id: "cathedral_op" },
  { re: /(لوگوی\s*(پیک|peak))/i, id: "peak_logo_op" },
  { re: /(مجسمه\s*(بساز|من))/i, id: "statue_op" },
  { re: /(رقصگاه\s*بساز|کف\s*رقص)/i, id: "dance_floor_op" },
  { re: /(پرش\s*همه|همه\s*بپرن)/i, id: "jump_boost_party" },
  { re: /(درخشش\s*همه|همه\s*بدرخشن)/i, id: "glow_all" },
  { re: /(کیت\s*اسپیدران)/i, id: "speedrun_kit" },
  { re: /(ماهیگیری\s*دیوانه)/i, id: "fishing_mania" },

  // «همه رو بکش» باید kill_all_mobs (ماب‌ها، هرگز بازیکن) شود نه kill_squad با بازیکن «همه»
  { re: /(\S{2,16})\s*رو\s*بکش(?:ش)?|بکش\s*(\S{2,16})/i,
    id: (m) => {
      const p = (m[1] || m[2] || "").trim();
      return /^(همه|همشون|همه‌شون|همه\s*رو)$/.test(p) ? "kill_all_mobs" : "kill_squad";
    },
    args: (m) => ({ player: (m[1] || m[2] || "").trim() }) },
  { re: /(اینا\s*رو\s*بردار|بردارشون|آیتم\s*ها\s*رو\s*بردار|چیزا\s*رو\s*بردار|pickup\s*items)/i, id: "pickup_items" },
  { re: /(\S{2,16})\s*رو\s*(?:به\s*)?دوستم\s*حساب\s*کن|(\S{2,16})\s*دوستمه/i, id: "friend_add", args: (m) => ({ player: (m[1] || m[2] || "").trim() }) },
  { re: /(\S{2,16})\s*دیگه\s*دوستم\s*نیست|(\S{2,16})\s*از\s*دوستام\s*بیرونش\s*کن/i, id: "friend_remove", args: (m) => ({ player: (m[1] || m[2] || "").trim() }) },
  { re: /(رجیستر\s*ش[وو]|رجیستر\s*کن|ثبت\s*نام\s*کن|ثبت\s*نام\s*شو|register\s*(?:now|me))/i, id: "server_register" },
  { re: /(لاگین\s*کن|وارد\s*حساب\s*شو|login\s*(?:now|me))/i, id: "server_login" }
];

/** مچ سریع جملهٔ فارسی → اکشن (null یعنی نشناخت) */
export function matchFastAction(
  text: string
): { id: string; args: Record<string, string> } | null {
  // هم متن اصلی، هم نسخهٔ ارقام انگلیسی و هم فینگیلیش→فارسی چک می‌شود
  // (مثل "Salam" یا «۵ الماس بده» که با ۵ فارسی تایپ شده)
  const raw = text.trim();
  const candidates = [
    raw,
    toEnglishDigits(raw),
    normalizeFinglish(raw).trim(),
    normalizeFinglish(toEnglishDigits(raw)).trim()
  ];
  for (const t of new Set(candidates)) {
    for (const p of FAST_PATTERNS) {
      const m = t.match(p.re);
      if (m) {
        return { id: typeof p.id === "function" ? p.id(m) : p.id, args: p.args ? p.args(m) : {} };
      }
    }
  }
  return null;
}

/** اجرای سریع جملهٔ فارسی — اگر نشناخت null */
export async function tryFastAction(
  text: string,
  ctx: ExecContext
): Promise<ActionResult | null> {
  const hit = matchFastAction(text);
  if (!hit) return null;
  return executeCapability(hit.id, hit.args, ctx);
}

/* ------------------------------------------------------------------ */
/* توکن‌های هوش مصنوعی:  «[[mc:id|args]]»                                */
/* (تعریف در ماژول سبک lib/mcTokens تا کلاینت هم بدون mineflayer کار کند)  */
/* ------------------------------------------------------------------ */

import { MC_TOKEN_RE, extractMcTokens, stripMcTokens } from "@/lib/pure-utils";

export { MC_TOKEN_RE, extractMcTokens, stripMcTokens };

/** اجرای توکن‌های جداشده */
export async function runMcTokens(
  actions: { id: string; args: Record<string, string> }[],
  ctx: ExecContext
): Promise<ActionResult[]> {
  const out: ActionResult[] = [];
  for (const a of actions.slice(0, 6)) {
    out.push(await executeCapability(a.id, a.args, ctx));
  }
  return out;
}

/** ساخت زمینهٔ اجرا از وضعیت فعلی */
export function buildContext(
  player: string | null,
  isOp: boolean
): ExecContext {
  return { player, isOp };
}
