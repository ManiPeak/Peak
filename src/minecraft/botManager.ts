/**
 * BotManager — ماژول اختصاصی کنترل ربات ماینکرفت (Singleton روی globalThis)
 *
 * معماری امن Whitelist: مدل زبانی هرگز کد دلخواه اجرا نمی‌کند؛
 * فقط دستورهای ازپیش‌تعریف‌شده از طریق پارسر فارسی اجرا می‌شوند.
 *
 * قابلیت‌های کلیدی:
 * - اتصال offline (سرورهای کرک / Open to LAN) و microsoft (Device-Code Flow)
 * - دستورهای زبان طبیعی فارسی
 * - حالت محافظت پلیسی (دنبال‌کردن + درگیری با ماب‌های خصم)
 * - حالت موشک (اسپرینت + پرش مداوم — ونیلا و بدون تقلب)
 * - اتوکلیک (حملهٔ خودکار مداوم به نزدیک‌ترین دشمن)
 */
import mineflayer, { type Bot } from "mineflayer";
import type { Entity } from "prismarine-entity";
import { Movements, goals, pathfinder } from "mineflayer-pathfinder";
import { plugin as collectBlockPlugin } from "mineflayer-collectblock";
import path from "node:path";
import fs from "node:fs";
import {
  BLOCK_MAP,
  MC_HELP_TEXT,
  normalizeBlockName,
  parseCommand
} from "@/minecraft/core";
import type {
  BotLogEntry,
  BotStatus,
  CommandResult,
  ConnectOptions,
  LogType
} from "@/minecraft/core";
import {
  AUTH_PASSWORD,
  isProtected,
  thanksForItems
} from "@/minecraft/core";
import { getSettings } from "@/lib/store";

/** فهرست ماب‌های خصم برای حالت محافظت و حملهٔ خودکار */
const HOSTILE_NAMES = new Set([
  "zombie",
  "skeleton",
  "creeper",
  "spider",
  "cave_spider",
  "enderman",
  "witch",
  "pillager",
  "vindicator",
  "evoker",
  "ravager",
  "vex",
  "phantom",
  "drowned",
  "husk",
  "stray",
  "zombie_villager",
  "zombified_piglin",
  "zombie_pigman",
  "slime",
  "magma_cube",
  "blaze",
  "ghast",
  "wither_skeleton",
  "guardian",
  "elder_guardian",
  "shulker",
  "silverfish",
  "endermite",
  "hoglin",
  "zoglin",
  "warden",
  "breeze",
  "bogged",
  "creaking"
]);

const MAX_LOGS = 250;
const GUARD_FOLLOW_DISTANCE = 2.5;

type GoalLike = InstanceType<(typeof goals)["Goal"]>;

class BotManager {
  private bot: Bot | null = null;
  private logs: BotLogEntry[] = [];
  private logSeq = 1;
  private connecting = false;
  private guardianMode = false;
  private rocketMode = false;
  private autoAttack = false;
  private protectTarget: string | null = null;
  private guardTimer: ReturnType<typeof setInterval> | null = null;
  private attackTimer: ReturnType<typeof setInterval> | null = null;
  private rocketTimer: ReturnType<typeof setInterval> | null = null;
  private wayTimer: ReturnType<typeof setInterval> | null = null;
  private autonomyTimer: ReturnType<typeof setInterval> | null = null;
  /** حافظهٔ مکان — جاهایی که ربات بوده (برای فرمان «برگرد») */
  private posHistory: { x: number; y: number; z: number; t: number }[] = [];
  private posLoaded = false;
  private lastError: string | null = null;
  private msDeviceCode: string | null = null;
  private chatListener: ((username: string, message: string) => void) | null =
    null;
  private connectInfo: { host: string; port: number; username: string | null } =
    { host: "", port: 25565, username: null };

  /* ---- حالت‌های شخصیتی و وود پمپ ---- */
  private personality: "angry" | "kind" | "normal" = "normal";
  private speedBoost = false;
  private speedTimer: ReturnType<typeof setInterval> | null = null;
  private personalityTimer: ReturnType<typeof setInterval> | null = null;
  private pendingAuth: "none" | "login" | "register" = "none";
  private lastThanksAt = 0;
  private killBusy = false;

  /* ---------------------------------------------------------------- */
  /* لاگ‌ها                                                            */
  /* ---------------------------------------------------------------- */

  /** ثبت یک رویداد در لاگ رنگی */
  private log(type: LogType, text: string): void {
    this.logs.push({ id: this.logSeq++, type, text, at: Date.now() });
    if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
  }

  /** دریافت لاگ‌ها (از شناسهٔ مشخص برای پولینگ) */
  getLogs(sinceId = 0): BotLogEntry[] {
    return this.logs.filter((l) => l.id > sinceId);
  }

  clearLogs(): void {
    this.logs = [];
  }

  /* ---------------------------------------------------------------- */
  /* وضعیت                                                             */
  /* ---------------------------------------------------------------- */

  getStatus(): BotStatus {
    const bot = this.bot;
    const entity = bot?.entity ?? null;
    return {
      connected: !!bot && !!entity,
      connecting: this.connecting,
      host: this.connectInfo.host || null,
      port: this.connectInfo.port || null,
      username: this.connectInfo.username,
      health: bot?.health ?? null,
      food: bot?.food ?? null,
      position: entity
        ? {
            x: Math.round(entity.position.x * 10) / 10,
            y: Math.round(entity.position.y * 10) / 10,
            z: Math.round(entity.position.z * 10) / 10
          }
        : null,
      dimension: (bot as unknown as { game?: { dimension?: string } })?.game
        ?.dimension
        ? String((bot as unknown as { game: { dimension: string } }).game.dimension)
        : null,
      players: bot ? Object.keys(bot.players).filter((p) => p !== bot.username) : [],
      guardianMode: this.guardianMode,
      rocketMode: this.rocketMode,
      autoAttack: this.autoAttack,
      protectTarget: this.protectTarget,
      lastError: this.lastError,
      msDeviceCode: this.msDeviceCode
    };
  }

  /* ---------------------------------------------------------------- */
  /* اتصال و قطع اتصال                                                */
  /* ---------------------------------------------------------------- */

  /** اتصال به سرور ماینکرفت */
  connect(opts: ConnectOptions): Promise<CommandResult> {
    return new Promise((resolve) => {
      if (this.bot) {
        this.log("warn", "اتصال قبلی قطع شد تا اتصال جدید برقرار بشه.");
        this.disconnect();
      }

      this.connecting = true;
      this.lastError = null;
      this.connectInfo = { host: opts.host, port: opts.port, username: opts.username };
      this.protectTarget = opts.protectTarget ?? null;
      this.pendingAuth = opts.authMode ?? "none";

      const version = opts.version === "auto" ? undefined : opts.version;

      this.log(
        "system",
        `در حال اتصال به ${opts.host}:${opts.port} با نام ${opts.username}...`
      );

      let settled = false;
      const settle = (result: CommandResult) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      try {
        const bot = mineflayer.createBot({
          host: opts.host,
          port: opts.port,
          username: opts.username,
          auth: opts.auth === "microsoft" ? "microsoft" : "offline",
          version,
          profilesFolder: path.join(process.cwd(), "accounts"),
          // نمایش کد Device-Code ورود مایکروسافت در برنامه
          onMsaCode: (data: {
            user_code: string;
            verification_uri: string;
            device_code: string;
            expires_in: number;
            interval: number;
            message: string;
          }) => {
            this.msDeviceCode = data.user_code;
            this.log(
              "warn",
              `برای ورود مایکروسافت به ${data.verification_uri} برو و کد ${data.user_code} را وارد کن.`
            );
          }
        } as Parameters<typeof mineflayer.createBot>[0]);

        this.bot = bot;
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(collectBlockPlugin);

        /* ---- رویدادهای زنده ---- */
        bot.once("login", () => {
          this.connecting = false;
          this.log("success", `وارد بازی شدم! نام ربات: ${bot.username}`);
          // تنظیمات مسیریابی
          const movements = new Movements(bot);
          movements.canDig = false;
          movements.allow1by1towers = true;
          movements.canOpenDoors = true;
          bot.pathfinder.setMovements(movements);
          this.startLoops();
          this.onSpawned();
          settle({
            ok: true,
            reply: `اتصال برقرار شد. ✅ الان توی سرور ${opts.host}:${opts.port} هستم با نام ${bot.username}.`,
            command: "status"
          });
        });

        bot.on("kicked", (reason: unknown) => {
          const text =
            typeof reason === "string" ? reason : JSON.stringify(reason);
          this.lastError = text.slice(0, 300);
          this.log("error", `از سرور کیک شدم: ${text.slice(0, 200)}`);
          this.cleanupAfterDisconnect();
          settle({
            ok: false,
            reply: `اتصال برقرار نشد؛ سرور منو بیرون کرد. دلیل: ${text.slice(0, 150)}`,
            command: "status"
          });
        });

        bot.on("error", (err: Error) => {
          this.lastError = err.message;
          this.log("error", `خطای اتصال: ${err.message}`);
          this.cleanupAfterDisconnect();
          settle({
            ok: false,
            reply: `اتصال ناموفق بود: ${err.message}`,
            command: "status"
          });
        });

        bot.on("end", (reason: unknown) => {
          const text = typeof reason === "string" ? reason : "پایان اتصال";
          this.log("warn", `اتصال قطع شد: ${text}`);
          this.cleanupAfterDisconnect();
        });

        bot.on("death", () => {
          this.log("event", "💀 ربات مرد! دوباره ریسپاون می‌شم...");
        });

        bot.on("message", (msg: { toString(): string }) => {
          const text = msg.toString();
          if (text.trim()) this.log("chat", text);
        });

        bot.on("whisper", (username: string, message: string) => {
          this.log("chat", `📨 ویسپر از ${username}: ${message}`);
          if (this.chatListener && username !== bot.username) {
            this.chatListener(username, message);
          }
        });

        bot.on("chat", (username: string, message: string) => {
          if (username === bot.username) return;
          // پل گفت‌وگوی داخل بازی — هوش طبیعی
          if (this.chatListener) this.chatListener(username, message);
        });

        bot.on("playerCollect", (_collector: Entity, _dropped: Entity) => {
          // رویداد جمع‌آوری آیتم — فقط لاگ سبک
        });

        bot.on("health", () => {
          if ((bot.health ?? 20) <= 6) {
            this.log("warn", `⚠️ جان کمه: ${bot.health}/20 — مراقب باش!`);
          }
        });

        // تایم‌اوت اتصال
        setTimeout(() => {
          if (this.connecting && !settled) {
            this.connecting = false;
            this.log("error", "مهلت اتصال تمام شد (۳۰ ثانیه).");
            this.disconnect();
            settle({
              ok: false,
              reply: "مهلت اتصال تمام شد. آدرس سرور و اینترنت رو چک کن.",
              command: "status"
            });
          }
        }, 30_000);
      } catch (err) {
        this.connecting = false;
        const message = err instanceof Error ? err.message : "خطای ناشناخته";
        this.lastError = message;
        this.log("error", `خطای ساخت ربات: ${message}`);
        settle({ ok: false, reply: `اتصال ناموفق بود: ${message}`, command: "status" });
      }
    });
  }

  /** قطع اتصال امن */
  disconnect(): void {
    this.stopLoops();
    if (this.bot) {
      try {
        this.bot.quit();
      } catch (err) {
        this.log(
          "error",
          `قطع اتصال ربات ناموفق بود: ${(err as Error).message}`
        );
      }
      this.bot = null;
    }
    this.connecting = false;
    this.log("system", "اتصال به سرور قطع شد.");
  }

  private cleanupAfterDisconnect(): void {
    this.stopLoops();
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
    if (this.personalityTimer) {
      clearInterval(this.personalityTimer);
      this.personalityTimer = null;
    }
    this.speedBoost = false;
    this.bot = null;
    this.connecting = false;
    this.guardianMode = false;
    this.rocketMode = false;
    this.autoAttack = false;
    this.msDeviceCode = null;
  }

  /* ---------------------------------------------------------------- */
  /* لوپ‌های حالت‌های ویژه                                             */
  /* ---------------------------------------------------------------- */

  private startLoops(): void {
    this.stopLoops();

    // لوپ محافظت پلیسی — هر ۸۰۰ میلی‌ثانیه
    this.guardTimer = setInterval(() => {
      if (!this.guardianMode) return;
      try {
        this.guardianTick();
      } catch (err) {
        this.log("error", `خطای حالت محافظت: ${(err as Error).message}`);
      }
    }, 800);

    // لوپ اتوکلیک/حملهٔ خودکار — هر ۳۰۰ میلی‌ثانیه
    this.attackTimer = setInterval(() => {
      if (!this.autoAttack && !this.guardianMode) return;
      try {
        this.attackTick();
      } catch (err) {
        this.log("error", `خطای حملهٔ خودکار: ${(err as Error).message}`);
      }
    }, 300);

    // لوپ حالت موشک — اسپرینت و پرش مداوم هنگام حرکت
    this.rocketTimer = setInterval(() => {
      if (!this.rocketMode || !this.bot) return;
      try {
        this.rocketTick();
      } catch (err) {
        this.log(
          "error",
          `حالت موشک ناموفق بود: ${(err as Error).message}`
        );
      }
    }, 500);

    // لوپ حافظهٔ مکان — هر ۳۰ ثانیه جایی که هست را یاد می‌کند
    this.wayTimer = setInterval(() => {
      if (!this.bot?.entity) return;
      try {
        this.recordPosition(false);
      } catch (err) {
        this.log(
          "error",
          `ثبت مکان در حافظه ناموفق بود: ${(err as Error).message}`
        );
      }
    }, 30000);

    // لوپ استقلال — سطح‌های «حرفه‌ای/خدا»: بدون دستور، برای تیم کار می‌کند
    this.autonomyTimer = setInterval(() => {
      if (!this.bot?.entity) return;
      try {
        void this.autonomyTick();
      } catch (err) {
        this.log(
          "error",
          `حلقهٔ استقلال ناموفق بود: ${(err as Error).message}`
        );
      }
    }, 20000);
  }

  private stopLoops(): void {
    if (this.guardTimer) clearInterval(this.guardTimer);
    if (this.attackTimer) clearInterval(this.attackTimer);
    if (this.rocketTimer) clearInterval(this.rocketTimer);
    if (this.wayTimer) clearInterval(this.wayTimer);
    if (this.autonomyTimer) clearInterval(this.autonomyTimer);
    this.guardTimer = this.attackTimer = this.rocketTimer = this.wayTimer = this.autonomyTimer = null;
  }

  /* ---------------------------------------------------------------- */
  /* استقلال بازی — سطح «خدا» دستش باز است: دفاع + استخراج برای تیم     */
  /* ---------------------------------------------------------------- */

  /** کار خودکار هر ۲۰ ثانیه در سطح‌های pro/god — مثل بازیکن واقعی موثر است */
  private async autonomyTick(): Promise<void> {
    const settings = getSettings();
    const level = settings.mcPlayLevel;
    if (level !== "pro" && level !== "god") return;
    const bot = this.bot;
    if (!bot?.entity || this.killBusy) return;

    // ۱) دفاع از تیم — اگر خصمی نزدیک بازیکن محافظت‌شده است (هرگز به دوستان حمله نمی‌شود)
    const target = this.resolveProtectEntity();
    if (target) {
      const hostile = this.nearestHostile(Math.max(8, settings.mcGuardRadius));
      if (hostile) {
        try {
          bot.attack(hostile);
          this.log("combat", `🛡 دفاع خودکار (${level}): ${hostile.name ?? "ماب"}`);
        } catch (err) {
          this.log(
            "error",
            `حملهٔ دفاعی ناموفق بود: ${(err as Error).message}`
          );
        }
        return;
      }
    }

    // ۲) استخراج منابع ارزشمند برای تیم — خدا: همه‌چیز، حرفه‌ای: آهن/طلا/ذغال
    const ores =
      level === "god"
        ? [
            "diamond_ore",
            "iron_ore",
            "gold_ore",
            "redstone_ore",
            "lapis_ore",
            "emerald_ore",
            "coal_ore"
          ]
        : ["iron_ore", "gold_ore", "coal_ore"];
    const scanR = Math.min(settings.mcScanRadius || 1000, 512);
    for (const ore of ores) {
      const id = bot.registry.blocksByName[ore]?.id;
      if (id == null) continue;
      const found = bot.findBlocks({
        matching: id,
        count: level === "god" ? 6 : 3,
        maxDistance: scanR
      });
      const blocks = found
        .map((p) => bot.blockAt(p))
        .filter((b): b is NonNullable<typeof b> => b != null);
      if (blocks.length === 0) continue;
      this.log("info", `⛏️ استخراج خودکار (${level}): ${ore} ×${blocks.length}`);
      await new Promise<void>((resolve) => {
        bot.collectBlock.collect(blocks, () => resolve());
      });
      return; // هر نوبت یک نوع منبع
    }
  }

  /** شعاع بزرگ اسکن محیط — تا ۱۰۰۰ بلوک (قابل افزایش تا ۱۰۰۰۰۰ از تنظیمات) */
  static readonly SCAN_RADIUS = 1000;

  /** اسکن کامل محیط اطراف — ماب‌ها، بازیکنان، آیتم‌ها و خطرها در شعاع بزرگ */
  scanArea(radius = getSettings().mcScanRadius || BotManager.SCAN_RADIUS): {
    hostiles: { name: string; dist: number }[];
    players: { name: string; dist: number; protected: boolean }[];
    animals: number;
    items: number;
    hazards: string[];
    radius: number;
  } {
    const bot = this.bot;
    const out = {
      hostiles: [] as { name: string; dist: number }[],
      players: [] as { name: string; dist: number; protected: boolean }[],
      animals: 0,
      items: 0,
      hazards: [] as string[],
      radius
    };
    if (!bot?.entity) return out;
    const settings = getSettings();
    for (const e of Object.values(bot.entities)) {
      if (!e || e === bot.entity || !e.position) continue;
      const d = e.position.distanceTo(bot.entity.position);
      if (d > radius) continue;
      const name = (e.name ?? "").toLowerCase();
      if (e.type === "player") {
        out.players.push({
          name: e.username ?? "player",
          dist: Math.round(d),
          protected: isProtected(e.username, settings, bot.username)
        });
      } else if (HOSTILE_NAMES.has(name) || e.kind === "Hostile mobs") {
        out.hostiles.push({ name: e.name ?? "mob", dist: Math.round(d) });
      } else if (e.kind === "Drops" || name.includes("item")) {
        out.items += 1;
      } else {
        out.animals += 1;
      }
    }
    out.hostiles.sort((a, b) => a.dist - b.dist);
    out.players.sort((a, b) => a.dist - b.dist);
    // خطرهای بلوکی: آتش، گدازه، TNT در شعاع اسکن
    try {
      const hazardNames = ["lava", "fire", "tnt", "magma_block", "cactus"];
      for (const hz of hazardNames) {
        const id = bot.registry.blocksByName[hz]?.id;
        if (id == null) continue;
        const found = bot.findBlocks({ matching: id, count: 3, maxDistance: radius });
        if (found.length > 0) out.hazards.push(`${hz}×${found.length}`);
      }
    } catch (err) {
      this.log(
        "error",
        `اسکن خطرها ناموفق بود: ${(err as Error).message}`
      );
    }
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* حافظهٔ مکان — یاد می‌کند کجا بوده تا با «برگرد» برگردد            */
  /* ---------------------------------------------------------------- */

  /** فایل ذخیرهٔ مکان‌ها (کنار دیتابیس — قابل‌نوشتن در نصب و پرتابل) */
  private waypointsFile(): string {
    const base = process.env.DASTIAR_DB_PATH
      ? path.dirname(process.env.DASTIAR_DB_PATH)
      : path.join(process.cwd(), "data");
    return path.join(base, "mc-waypoints.json");
  }

  /** بارگذاری مکان‌های یادشده از دیسک (یک‌بار) */
  private loadWaypoints(): void {
    if (this.posLoaded) return;
    this.posLoaded = true;
    try {
      const f = this.waypointsFile();
      if (fs.existsSync(f)) {
        const j = JSON.parse(fs.readFileSync(f, "utf8")) as {
          waypoints?: { x: number; y: number; z: number; t: number }[];
        };
        if (Array.isArray(j.waypoints)) this.posHistory = j.waypoints.slice(-50);
      }
    } catch (err) {
      this.log(
        "error",
        `خواندن مکان‌های ذخیره‌شده ناموفق بود: ${(err as Error).message}`
      );
    }
  }

  /** ذخیرهٔ مکان‌ها روی دیسک تا بعد از قطع اتصال هم یادش بماند */
  private persistWaypoints(): void {
    try {
      const f = this.waypointsFile();
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(
        f,
        JSON.stringify({ waypoints: this.posHistory.slice(-50) }),
        "utf8"
      );
    } catch (err) {
      this.log(
        "error",
        `ذخیرهٔ مکان‌ها روی دیسک ناموفق بود: ${(err as Error).message}`
      );
    }
  }

  /** ثبت موقعیت فعلی در حافظه — فقط وقتی واقعاً جای جدیدی است (مگر force) */
  private recordPosition(force: boolean): void {
    const bot = this.bot;
    if (!bot?.entity) return;
    this.loadWaypoints();
    const p = bot.entity.position;
    const last = this.posHistory[this.posHistory.length - 1];
    const d = last
      ? Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z)
      : Infinity;
    if (!force && d < 15) return;
    this.posHistory.push({ x: p.x, y: p.y, z: p.z, t: Date.now() });
    if (this.posHistory.length > 50) this.posHistory.shift();
    this.persistWaypoints();
    this.log("info", `📍 مکان یاد شد: ${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`);
  }

  /** «اینجا رو یاد کن» — ثبت فوری موقعیت فعلی */
  markHere(): Promise<CommandResult> {
    const bot = this.bot;
    if (!bot?.entity) {
      return Promise.resolve({
        ok: false,
        reply: "اتصال برقرار نیست.",
        command: "mark_here"
      });
    }
    this.recordPosition(true);
    const p = bot.entity.position;
    return Promise.resolve({
      ok: true,
      reply: `📍 اینجا رو یاد کردم: ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`,
      command: "mark_here"
    });
  }

  /** «برگرد» — برگشت به آخرین جایی که بوده (هر بار یک قدم عقب‌تر) */
  goBack(): Promise<CommandResult> {
    const bot = this.bot;
    if (!bot?.entity) {
      return Promise.resolve({
        ok: false,
        reply: "اتصال برقرار نیست.",
        command: "go_back"
      });
    }
    this.loadWaypoints();
    const pos = bot.entity.position;
    // نزدیک‌ترین نقطهٔ ثبت‌شده که واقعاً «جای دیگری» است
    let idx = -1;
    for (let i = this.posHistory.length - 1; i >= 0; i--) {
      const w = this.posHistory[i];
      const d = Math.hypot(w.x - pos.x, w.y - pos.y, w.z - pos.z);
      if (d > 12) {
        idx = i;
        break;
      }
    }
    if (idx < 0) {
      return Promise.resolve({
        ok: false,
        reply: "جای دیگه‌ای یادم نیست — همین دور و برم بودم. 🤷",
        command: "go_back"
      });
    }
    const target = this.posHistory[idx];
    // حذف تا دفعهٔ بعدی «برگرد»، یک جای عقب‌تر برود
    this.posHistory = this.posHistory.slice(0, idx);
    this.persistWaypoints();
    const tx = Math.round(target.x);
    const ty = Math.round(target.y);
    const tz = Math.round(target.z);
    const settings = getSettings();
    if (settings.mcIsOp) {
      this.opCommand(`tp ${bot.username} ${tx} ${ty} ${tz}`);
    } else {
      bot.pathfinder.setGoal(new goals.GoalNear(tx, ty, tz, 2));
    }
    this.log("info", `↩️ در حال برگشت به ${tx},${ty},${tz}`);
    return Promise.resolve({
      ok: true,
      reply: `↩️ برگشتم به جای قبلی: ${tx}, ${ty}, ${tz}`,
      command: "go_back"
    });
  }

  /** پیدا کردن نزدیک‌ترین ماب خصم */
  nearestHostile(maxDistance = 48): Entity | null {
    const bot = this.bot;
    if (!bot?.entity) return null;
    let best: Entity | null = null;
    let bestDist = maxDistance;
    for (const e of Object.values(bot.entities)) {
      if (!e || e === bot.entity || !e.position || !e.name) continue;
      const hostile =
        HOSTILE_NAMES.has(e.name.toLowerCase()) || e.kind === "Hostile mobs";
      if (!hostile) continue;
      const d = e.position.distanceTo(bot.entity.position);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  /** پیدا کردن موجودیت بازیکنِ هدف محافظت */
  private resolveProtectEntity(): Entity | null {
    const bot = this.bot;
    if (!bot?.entity) return null;

    // اول بازیکن هدف مشخص‌شده
    if (this.protectTarget) {
      const p = bot.players[this.protectTarget];
      if (p?.entity) return p.entity;
    }

    // نزدیک‌ترین بازیکن دیگر
    let best: Entity | null = null;
    let bestDist = 64;
    for (const [name, p] of Object.entries(bot.players)) {
      if (name === bot.username || !p.entity) continue;
      const d = p.entity.position.distanceTo(bot.entity.position);
      if (d < bestDist) {
        best = p.entity;
        bestDist = d;
      }
    }
    return best;
  }

  /** یک قدم از لوپ محافظت */
  private guardianTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;

    const target = this.resolveProtectEntity();
    const hostile = this.nearestHostile(16);

    if (hostile?.position) {
      // دشمن نزدیکه — درگیر شو
      const dist = hostile.position.distanceTo(bot.entity.position);
      if (dist > 2.5) {
        const { x, y, z } = hostile.position;
        bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 2));
      } else {
        bot.pathfinder.setGoal(null);
      }
      return;
    }

    // دشمنی نیست — کنار بازیکن هدف بایست
    if (target) {
      const dist = target.position.distanceTo(bot.entity.position);
      if (dist > 4.5) {
        bot.pathfinder.setGoal(
          new goals.GoalFollow(target, GUARD_FOLLOW_DISTANCE)
        );
      } else {
        bot.pathfinder.setGoal(null);
      }
      // به اطراف نگاه کن تا تهدیدها رو ببینی
      const yaw = Math.atan2(-Math.cos(Date.now() / 2500), 1);
      bot.look(yaw, 0, false).catch(() => undefined);
    }
  }

  /** یک قدم از لوپ حملهٔ خودکار (اتوکلیک) */
  private attackTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;

    const range = this.autoAttack ? 64 : 32;
    const hostile = this.nearestHostile(range);
    if (!hostile) return;

    const dist = hostile.position.distanceTo(bot.entity.position);
    if (dist < 3.6) {
      // کلیک چپ مداوم روی دشمن
      bot.attack(hostile);
      bot.swingArm("right");
    }
  }

  /** یک قدم از حالت موشک */
  private rocketTick(): void {
    const bot = this.bot;
    if (!bot?.entity) return;
    const v = bot.entity.velocity;
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    bot.setControlState("sprint", true);
    if (speed > 0.08) {
      bot.setControlState("jump", true);
    } else {
      bot.setControlState("jump", false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌های حرکت                                                    */
  /* ---------------------------------------------------------------- */

  private requireBot(): Bot | null {
    if (!this.bot?.entity) {
      return null;
    }
    return this.bot;
  }

  private setGoal(goal: GoalLike | null): void {
    const bot = this.bot;
    if (!bot) return;
    bot.pathfinder.setGoal(goal);
    if (this.rocketMode) {
      bot.setControlState("sprint", true);
    }
  }

  /* ---------------------------------------------------------------- */
  /* توقف فوری (دکمه قرمز)                                            */
  /* ---------------------------------------------------------------- */

  /** توقف کامل: اهداف مسیر، حرکت، کلنگ‌زنی، وضعیت کلیدها و حالت‌های فعال */
  emergencyStop(): CommandResult {
    const bot = this.bot;
    this.guardianMode = false;
    this.rocketMode = false;
    this.autoAttack = false;
    this.speedBoost = false;
    this.killBusy = false;
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
    if (this.personalityTimer) {
      clearInterval(this.personalityTimer);
      this.personalityTimer = null;
    }

    if (bot) {
      try {
        bot.pathfinder.setGoal(null);
      } catch (err) {
        this.log(
          "error",
          `لغو مسیریابی ناموفق بود: ${(err as Error).message}`
        );
      }
      try {
        bot.collectBlock.cancelTask();
      } catch (err) {
        this.log(
          "error",
          `لغو وظیفهٔ جمع‌آوری بلوک ناموفق بود: ${(err as Error).message}`
        );
      }
      try {
        bot.clearControlStates();
      } catch (err) {
        this.log(
          "error",
          `پاک‌کردن وضعیت کنترل ناموفق بود: ${(err as Error).message}`
        );
      }
    }

    this.log("system", "🛑 توقف فوری اجرا شد؛ همه‌چیز متوقفه.");
    return {
      ok: true,
      reply:
        "🛑 چشم، همه‌چیز متوقف شد: مسیر، حرکت، کلنگ‌زنی، اتوکلیک و حالت محافظت. هر وقت گفتی دوباره بلند می‌شم.",
      command: "stop"
    };
  }

  /* ---------------------------------------------------------------- */
  /* حالت‌های شخصیتی — vood pump / مهربون / عادی                         */
  /* ---------------------------------------------------------------- */

  /** کارهای بعد از ورود به بازی: رجیستر/لاگین خودکار + برداشتن آیتم + شخصیت */
  private onSpawned(): void {
    const bot = this.bot;
    if (!bot) return;

    // ورود خودکار سرورهای کرکی (AuthMe و…) — رمز همیشه ثابت
    if (this.pendingAuth === "register") {
      setTimeout(() => {
        bot.chat(`/register ${AUTH_PASSWORD} ${AUTH_PASSWORD}`);
        this.log("system", "🔐 دستور /register با رمز ثابت ارسال شد.");
        setTimeout(() => bot.chat(`/login ${AUTH_PASSWORD}`), 900);
      }, 1400);
    } else if (this.pendingAuth === "login") {
      setTimeout(() => {
        bot.chat(`/login ${AUTH_PASSWORD}`);
        this.log("system", "🔐 دستور /login با رمز ثابت ارسال شد.");
      }, 1400);
    }

    // وقتی جلوی پای ربات آیتم انداختی — بردار و تشکر کن
    bot.on("itemDrop", (item: { position?: { x: number; y: number; z: number } }) => {
      try {
        const me = this.bot?.entity?.position;
        if (!me || !item?.position) return;
        const d = Math.hypot(me.x - item.position.x, me.y - item.position.y, me.z - item.position.z);
        if (d <= 5) this.pickupAndThank();
      } catch (err) {
        this.log(
          "error",
          `برداشتن آیتم ناموفق بود: ${(err as Error).message}`
        );
      }
    });

    // همگام‌سازی شخصیت از تنظیمات برنامه
    void import("@/lib/store")
      .then((m) => this.setPersonality(m.getSettings().mcPersonality ?? "normal"))
      .catch((err: unknown) => {
        this.log(
          "error",
          `خواندن شخصیت از تنظیمات ناموفق بود: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
  }

  /** تغییر حالت شخصیتی (زیرمجموعهٔ حالت ماینکرفت) */
  setPersonality(mode: "angry" | "kind" | "normal"): CommandResult {
    this.personality = mode;
    if (this.personalityTimer) {
      clearInterval(this.personalityTimer);
      this.personalityTimer = null;
    }
    if (mode === "angry") {
      // vood pump: سرعت زیاد + اتوکلیک + جنگ‌طلبی
      this.autoAttack = true;
      this.setSpeedBoost(true);
      this.personalityTimer = setInterval(() => this.angryTick(), 1500);
    } else if (mode === "kind") {
      this.setSpeedBoost(false);
      this.personalityTimer = setInterval(() => this.kindTick(), 1500);
    } else {
      this.setSpeedBoost(false);
    }
    const label =
      mode === "angry"
        ? "🔥 vood pump (فوق‌العاده عصبانی)"
        : mode === "kind"
          ? "💚 فوق‌العاده مهربون"
          : "💙 عادی";
    this.log("system", `حالت شخصیت: ${label}`);
    return { ok: true, reply: `${label} فعال شد.`, command: "personality" };
  }

  getPersonality(): "angry" | "kind" | "normal" {
    return this.personality;
  }

  /** نزدیک‌ترین بازیکن غیردوست — منطق مشترک vood pump / نبرد خدایی (هرگز دوستان) */
  nearestEnemyPlayer(maxDistance = 24): Entity | null {
    const bot = this.bot;
    if (!bot?.entity) return null;
    const settings = getSettings();
    let best: Entity | null = null;
    let bestDist = maxDistance;
    for (const e of Object.values(bot.entities)) {
      if (!e || e === bot.entity || e.type !== "player" || !e.position) continue;
      if (isProtected(e.username, settings, bot.username)) continue;
      const d = bot.entity.position.distanceTo(e.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /** موجودیت بازیکن فقط با نام دقیق — بدون fallback به هدف محافظت (برای اهداف حمله/مهروموم) */
  findPlayerStrict(name: string): Entity | null {
    const p = this.bot?.players[name];
    return p?.entity ?? null;
  }

  /** vood pump — حمله به نزدیک‌ترین بازیکن غیردوست (جنگ‌طلبی) */
  private angryTick(): void {
    const bot = this.bot;
    if (!bot?.entity || this.killBusy) return;
    const settings = getSettings();
    const best = this.nearestEnemyPlayer(12);
    if (best) {
      try {
        bot.attack(best);
      } catch (err) {
        this.log(
          "error",
          `حملهٔ vood pump ناموفق بود: ${(err as Error).message}`
        );
      }
      this.log("combat", `🔥 vood pump: حمله به ${best.username ?? "بازیکن"} نزدیک!`);
      if (settings.mcIsOp) void this.tpNear(best.position);
    }
  }

  /** مهربون — محافظت از همهٔ بازیکنان در برابر ماب‌ها */
  private kindTick(): void {
    const bot = this.bot;
    if (!bot?.entity || this.killBusy) return;
    const settings = getSettings();
    const range = Math.max(8, settings.mcGuardRadius);
    let best: Entity | null = null;
    let bestDist = range;
    for (const e of Object.values(bot.entities)) {
      if (!e || e === bot.entity || !e.position || !e.name) continue;
      const hostile = HOSTILE_NAMES.has(e.name.toLowerCase()) || e.kind === "Hostile mobs";
      if (!hostile) continue;
      const d = bot.entity.position.distanceTo(e.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (best) {
      try {
        bot.attack(best);
      } catch (err) {
        this.log(
          "error",
          `حملهٔ محافظت مهربونانه ناموفق بود: ${(err as Error).message}`
        );
      }
      this.log("combat", `💚 محافظت مهربونانه: زدن ${best.name ?? "ماب"} مزاحم!`);
    }
  }

  /** تلپورت کنار یک مختصات (فقط OP) — برای نبرد/مهروموم هم استفاده می‌شود */
  async tpNear(pos: { x: number; y: number; z: number }): Promise<void> {
    const bot = this.bot;
    if (!bot || !getSettings().mcIsOp) return;
    bot.chat(`/tp ${bot.username} ${(pos.x + 1.3).toFixed(2)} ${pos.y.toFixed(2)} ${(pos.z + 1.3).toFixed(2)}`);
    await new Promise((r) => setTimeout(r, 130));
  }

  /** فرمان کشتن: هدف + اطرافیانش — بجز من و دوستان */
  async killSquad(targetName: string): Promise<CommandResult> {
    const bot = this.bot;
    const settings = getSettings();
    // اول همیشه: محافظ دوستان — حتی قبل از چک اتصال
    if (isProtected(targetName, settings, bot?.username ?? null)) {
      return {
        ok: false,
        reply: "❌ این بازیکن جزو دوستای منه؛ بهش حمله نمی‌کنم! فقط غریبه‌ها.",
        command: "kill"
      };
    }
    if (!bot?.entity) {
      return { ok: false, reply: "اول به سرور وصلم کن تا اجرا کنم.", command: "kill" };
    }
    // نام دقیق — بدون fallback به هدف محافظت (وگرنه نام اشتباهی می‌توانست به «مالک» برسد)
    const target = this.findPlayerStrict(targetName);
    if (!target) {
      return { ok: false, reply: `بازیکن «${targetName}» اینجا نیست.`, command: "kill" };
    }
    this.killBusy = true;
    try {
      if (settings.mcIsOp) await this.tpNear(target.position);
      await bot.attack(target);
      this.log("combat", `⚔️ حمله به ${targetName}!`);
      let extra = 0;
      const others = Object.values(bot.players)
        .map((p) => p.entity)
        .filter((e): e is Entity => {
          if (!e || e === target || e.type !== "player" || !e.position) return false;
          if (isProtected(e.username, settings, bot.username)) return false;
          return bot.entity!.position.distanceTo(e.position) <= 8;
        });
      for (const e of others) {
        if (settings.mcIsOp) await this.tpNear(e.position);
        try {
        await bot.attack(e);
      } catch (err) {
        this.log(
          "error",
          `حمله به بازیکن اطرافیان ناموفق بود: ${(err as Error).message}`
        );
      }
        extra++;
        this.log("combat", `⚔️ حمله به ${e.username ?? "بازیکن"} (از اطرافیان ${targetName})`);
      }
      return {
        ok: true,
        reply: `⚔️ ${targetName} رو زدم${extra ? ` + ${extra} نفر از اطرافیانش` : ""} — البته دوستات امن بودن!`,
        command: "kill"
      };
    } finally {
      this.killBusy = false;
    }
  }

  /** حالت سرعت زیاد: اسپرینت+پرش همیشه؛ تلپورت پی‌درپی جلو (اگر OP) */
  setSpeedBoost(on: boolean): CommandResult {
    const bot = this.bot;
    this.speedBoost = on;
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
    if (!on) {
      if (bot && !this.rocketMode) bot.clearControlStates();
      this.log("system", "⚡ حالت سرعت خاموش شد.");
      return { ok: true, reply: "⚡ سرعت خاموش شد.", command: "speed" };
    }
    this.log("system", "⚡ حالت سرعت موشکی روشن شد!");
    if (bot) {
      bot.setControlState("sprint", true);
      bot.setControlState("jump", true);
    }
    const isOp = getSettings().mcIsOp;
    if (isOp && bot) {
      this.speedTimer = setInterval(() => {
        const b = this.bot;
        if (!b?.entity) return;
        const yaw = b.entity.yaw;
        const x = b.entity.position.x - Math.sin(yaw) * 1.7;
        const z = b.entity.position.z + Math.cos(yaw) * 1.7;
        const y = b.entity.position.y + 0.05;
        b.chat(`/tp ${b.username} ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
      }, 300);
    }
    return {
      ok: true,
      reply: isOp
        ? "⚡ سرعت مثل موشک زیاد شد! (تلپورتی — چون OP‌ام)"
        : "⚡ سرعت زیاد شد (اسپرینت+پرش). برای سرعت تلپورتی، تیک OP رو بزن.",
      command: "speed"
    };
  }

  isSpeedBoost(): boolean {
    return this.speedBoost;
  }

  /** برداشتن آیتم‌های جلوی پا + تشکر (درخواست کاربر) */
  pickupItems(): CommandResult {
    this.pickupAndThank();
    return {
      ok: true,
      reply: "📦 چشم، آیتم‌ها رو برمی‌دارم! ممنونم 🙏",
      command: "pickup"
    };
  }

  /** برداشتن آیتم‌های جلوی پای ربات + تشکر از کاربر */
  private pickupAndThank(): void {
    const bot = this.bot;
    if (!bot?.entity) return;
    const now = Date.now();
    if (now - this.lastThanksAt < 4500) return;
    this.lastThanksAt = now;
    void (async () => {
      try {
        const me = bot.entity!.position;
        const items = Object.values(bot.entities).filter(
          (e) =>
            e &&
            e.position &&
            (e.name === "item" || e.type === "object") &&
            me.distanceTo(e.position) <= 5
        );
        const first = items[0];
        if (first?.position) {
          const settings = getSettings();
          if (settings.mcIsOp) {
            bot.chat(
              `/tp ${bot.username} ${first.position.x.toFixed(2)} ${first.position.y.toFixed(2)} ${first.position.z.toFixed(2)}`
            );
          } else {
            bot.pathfinder.setGoal(
              new goals.GoalNear(first.position.x, first.position.y, first.position.z, 1)
            );
          }
          await new Promise((r) => setTimeout(r, getSettings().mcIsOp ? 450 : 1600));
        }
        const user = getSettings().userName;
        bot.chat(thanksForItems(user));
        this.log("chat", `🙏 از ${user} بابت آیتم‌ها تشکر کردم.`);
      } catch (err) {
        this.log(
          "error",
          `تشکر از بابت آیتم ناموفق بود: ${(err as Error).message}`
        );
      }
    })();
  }

  /* ---------------------------------------------------------------- */
  /* API عمومی برای موتور اکشن‌ها و پل چت بازی                          */
  /* ---------------------------------------------------------------- */

  /** دسترسی مستقیم به bot (برای actions.ts) */
  getBot(): Bot | null {
    return this.bot;
  }

  /** عکس فوری از وضعیت برای اکشن‌های اطلاعاتی */
  getSnapshot(): {
    connected: boolean;
    username: string | null;
    pos: { x: number; y: number; z: number } | null;
    health: number | null;
    food: number | null;
    players: string[];
    dimension: string | null;
  } {
    const b = this.bot;
    if (!b) {
      return {
        connected: false,
        username: this.connectInfo.username,
        pos: null,
        health: null,
        food: null,
        players: [],
        dimension: null
      };
    }
    const p = b.entity?.position;
    return {
      connected: true,
      username: b.username,
      pos: p ? { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) } : null,
      health: b.health ?? null,
      food: b.food ?? null,
      players: Object.keys(b.players ?? {}),
      dimension: (b.game as { dimension?: string } | undefined)?.dimension ?? null
    };
  }

  /** پیام در چت بازی */
  rawChat(text: string): boolean {
    if (!this.bot) return false;
    this.bot.chat(text);
    this.log("chat", `🤖 گفتم: ${text}`);
    return true;
  }

  /** اجرای دستور اسلش (نیاز به OP سرور) */
  opCommand(command: string): boolean {
    if (!this.bot) return false;
    const cmd = command.startsWith("/") ? command : `/${command}`;
    this.bot.chat(cmd);
    this.log("system", `⚡ دستور OP: ${cmd}`);
    return true;
  }

  /** روشن/خاموش کردن حالت‌ها از بیرون */
  setGuardMode(on: boolean): void {
    this.guardianMode = on;
    if (on && !this.protectTarget) {
      const t = this.resolveProtectEntity();
      const b = this.bot;
      if (t && b) {
        for (const [name, p] of Object.entries(b.players)) {
          if (p.entity === t) this.protectTarget = name;
        }
      }
    }
    this.log("system", on ? "🛡️ محافظت روشن شد." : "🛡️ محافظت خاموش شد.");
  }

  setRocketMode(on: boolean): void {
    this.rocketMode = on;
    this.log("system", on ? "🚀 حالت موشکی روشن شد." : "حالت موشکی خاموش شد.");
  }

  setAutoAttackMode(on: boolean): void {
    this.autoAttack = on;
    this.log("system", on ? "⚔️ اتوکلیک روشن شد." : "اتوکلیک خاموش شد.");
  }

  /** پیدا کردن موجودیت بازیکن با نام (خالی = نزدیک‌ترین/هدف محافظت) */
  resolvePlayerEntity(name?: string | null): Entity | null {
    if (!this.bot) return null;
    if (name) {
      const p = this.bot.players[name];
      if (p?.entity) return p.entity;
    }
    return this.resolveProtectEntity();
  }

  /** ثبت شنوندهٔ چت بازی (پل گفت‌وگو) */
  setChatListener(
    fn: ((username: string, message: string) => void) | null
  ): void {
    this.chatListener = fn;
  }

  /* ---------------------------------------------------------------- */
  /* اجرای دستورهای زبان طبیعی                                        */
  /* ---------------------------------------------------------------- */

  /** اجرای متن فارسی کاربر — اگر دستور ماینکرفتی نباشد، command: 'none' */
  async runCommand(
    rawText: string,
    gate: (perm: "control" | "guard" | "autoAttack") => boolean = () => true
  ): Promise<CommandResult> {
    const cmd = parseCommand(rawText);
    if (!cmd) return { ok: false, reply: "", command: "none" };

    // گیت دسترسی‌ها — هر دسته از دستورها مجوز خودش را می‌خواهد
    const need: "control" | "guard" | "autoAttack" | null =
      cmd.type === "guard"
        ? "guard"
        : cmd.type === "autoAttack"
          ? "autoAttack"
          : cmd.type === "help" || cmd.type === "status"
            ? null
            : "control";
    if (need && !gate(need)) {
      const labels: Record<string, string> = {
        control: "کنترل ربات",
        guard: "حالت محافظت",
        autoAttack: "حملهٔ خودکار"
      };
      return {
        ok: false,
        reply: `🔒 دسترسی «${labels[need]}» بسته است. از بخش دسترسی‌ها می‌توانی بازش کنی.`,
        command: cmd.type
      };
    }

    const bot = this.bot;

    // راهنما و وضعیت حتی بدون اتصال هم جواب می‌دن
    if (cmd.type === "help") {
      return { ok: true, reply: MC_HELP_TEXT, command: "help" };
    }

    if (cmd.type === "status") {
      const s = this.getStatus();
      if (!s.connected) {
        return {
          ok: true,
          reply: `الان به هیچ سروری وصل نیستم${s.lastError ? ` (آخرین خطا: ${s.lastError})` : ""}. از صفحهٔ ماینکرفت وصلم کن.`,
          command: "status"
        };
      }
      const players =
        s.players.length > 0 ? s.players.join("، ") : "کسی دیگه آنلاین نیست";
      return {
        ok: true,
        reply: `📊 گزارش وضعیت:
• مختصات: X=${s.position?.x} Y=${s.position?.y} Z=${s.position?.z}
• جان: ${s.health}/20 — سیری: ${s.food}/20
• بعد: ${s.dimension ?? "نامشخص"}
• بازیکنان آنلاین: ${players}
• محافظت: ${s.guardianMode ? "روشن" : "خاموش"} | موشک: ${s.rocketMode ? "روشن" : "خاموش"} | اتوکلیک: ${s.autoAttack ? "روشن" : "خاموش"}`,
        command: "status"
      };
    }

    // بقیهٔ دستورها نیاز به اتصال دارن
    if (!bot) {
      return {
        ok: false,
        reply: "فعلاً به سروری وصل نیستم. اول از صفحهٔ ماینکرفت به سرور وصلم کن، بعد دستور بده.",
        command: cmd.type
      };
    }

    switch (cmd.type) {
      case "follow": {
        const target = this.resolveProtectEntity();
        if (!target) {
          return {
            ok: false,
            reply: "بازیکنی این اطراف نیست که دنبالش بیام! 🤔",
            command: "follow"
          };
        }
        this.setGoal(new goals.GoalFollow(target, GUARD_FOLLOW_DISTANCE));
        this.log("info", "در حال دنبال‌کردن بازیکن...");
        return {
          ok: true,
          reply: "چشم، دارم دنبالت میام! 🏃",
          command: "follow"
        };
      }

      case "come": {
        const target = this.resolveProtectEntity();
        if (!target) {
          return {
            ok: false,
            reply: "پیدات نمی‌کنم! یه بازیکن باید اطرافم باشه.",
            command: "come"
          };
        }
        const { x, y, z } = target.position;
        this.setGoal(new goals.GoalNear(x, y, z, 2));
        this.log("info", "در حال رفتن به سمت بازیکن...");
        return { ok: true, reply: "دارم میام پیشت! ⚡", command: "come" };
      }

      case "stop": {
        return this.emergencyStop();
      }

      case "goto": {
        const { x, y, z } = cmd;
        this.setGoal(new goals.GoalNear(x, y, z, 2));
        this.log("info", `در حال رفتن به مختصات ${x} ${y} ${z}`);
        return {
          ok: true,
          reply: `دارم می‌رم به مختصات ${x} ${y} ${z}. 🧭`,
          command: "goto"
        };
      }

      case "go_back": {
        return this.goBack();
      }

      case "mark_here": {
        return this.markHere();
      }

      case "collect": {
        const blockName = normalizeBlockName(cmd.block) ?? cmd.block;
        return this.collectBlocks(blockName);
      }

      case "jump": {
        bot.setControlState("jump", true);
        setTimeout(() => bot?.setControlState("jump", false), 450);
        return { ok: true, reply: "هپ! پریدم. 🐇", command: "jump" };
      }

      case "look": {
        const target = this.resolveProtectEntity();
        if (target) {
          await bot.lookAt(
            target.position.offset(0, (target.height ?? 1.8) - 0.2, 0)
          );
          return { ok: true, reply: "دارم نگات می‌کنم! 👀", command: "look" };
        }
        return {
          ok: false,
          reply: "کسی اینجا نیست که بهش نگاه کنم.",
          command: "look"
        };
      }

      case "say": {
        bot.chat(cmd.text);
        this.log("chat", `🤖 گفتم: ${cmd.text}`);
        return {
          ok: true,
          reply: `توی چت گفتم: «${cmd.text}»`,
          command: "say"
        };
      }

      case "guard": {
        this.guardianMode = cmd.on;
        if (cmd.on && !this.protectTarget) {
          const t = this.resolveProtectEntity();
          if (t) {
            // نام بازیکن رو از لیست بازیکنان پیدا کن
            for (const [name, p] of Object.entries(bot.players)) {
              if (p.entity === t) this.protectTarget = name;
            }
          }
        }
        this.log(
          "system",
          cmd.on ? "🛡️ حالت محافظت (پلیسی) روشن شد." : "حالت محافظت خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "🛡️ چشم! حالت محافظت روشن شد. عین پلیس کنارت می‌مونم و به هر ماب خصمی که نزدیک بشه حمله می‌کنم."
            : "محافظت رو خاموش کردم.",
          command: "guard"
        };
      }

      case "rocket": {
        this.rocketMode = cmd.on;
        if (bot) {
          bot.setControlState("sprint", cmd.on);
          if (!cmd.on) bot.setControlState("jump", false);
        }
        this.log(
          "system",
          cmd.on ? "🚀 حالت موشک روشن شد." : "حالت موشک خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "🚀 حالت موشک روشن! با سرعت کامل و پرش‌های پیاپی حرکت می‌کنم."
            : "حالت موشک خاموش شد؛ با سرعت عادی حرکت می‌کنم.",
          command: "rocket"
        };
      }

      case "autoAttack": {
        this.autoAttack = cmd.on;
        this.log(
          "system",
          cmd.on ? "⚔️ اتوکلیک (حملهٔ خودکار) روشن شد." : "اتوکلیک خاموش شد."
        );
        return {
          ok: true,
          reply: cmd.on
            ? "⚔️ اتوکلیک روشن شد! عین موشک به نزدیک‌ترین دشمن کلیک چپ می‌زنم تا نیستش کنم."
            : "اتوکلیک خاموش شد.",
          command: "autoAttack"
        };
      }

      default:
        return { ok: false, reply: "", command: "none" };
    }
  }

  /** جمع‌آوری بلوک با افزونهٔ collectblock (شعاع ۹۶) */
  private collectBlocks(blockName: string): Promise<CommandResult> {
    const bot = this.bot;
    if (!bot) {
      return Promise.resolve({
        ok: false,
        reply: "اتصال برقرار نیست.",
        command: "collect"
      });
    }

    const blockId = bot.registry.blocksByName[blockName]?.id;
    if (blockId == null) {
      return Promise.resolve({
        ok: false,
        reply: `بلوک «${blockName}» رو نمی‌شناسم. اسمایی مثل چوب، سنگ، خاک، الماس، آهن رو امتحان کن.`,
        command: "collect"
      });
    }

    const positions = bot.findBlocks({
      matching: blockId,
      count: 12,
      maxDistance: 96
    });

    const blocks = positions
      .map((p) => bot.blockAt(p))
      .filter((b): b is NonNullable<typeof b> => b != null);

    if (blocks.length === 0) {
      return Promise.resolve({
        ok: false,
        reply: `تا شعاع ۹۶ بلوکی «${blockName}» پیدا نکردم. 🤷`,
        command: "collect"
      });
    }

    this.log("info", `در حال جمع‌آوری ${blocks.length} بلوک ${blockName}...`);

    return new Promise((resolve) => {
      bot.collectBlock.collect(
        blocks,
        (err: Error | null | undefined) => {
          if (err) {
            this.log("error", `خطای جمع‌آوری: ${err.message}`);
            resolve({
              ok: false,
              reply: `جمع‌آوری نصفه موند: ${err.message}`,
              command: "collect"
            });
          } else {
            this.log("success", `جمع‌آوری ${blocks.length} بلوک تموم شد.`);
            resolve({
              ok: true,
              reply: `تموم شد! ${blocks.length} تا ${blockName} جمع کردم. ⛏️`,
              command: "collect"
            });
          }
        }
      );
    });
  }
}

/* ------------------------------------------------------------------ */
/* Singleton روی globalThis تا در HMR از بین نرود                       */
/* ------------------------------------------------------------------ */

const globalForMc = globalThis as unknown as {
  __dastiarBotManager?: BotManager;
};

if (!globalForMc.__dastiarBotManager) {
  globalForMc.__dastiarBotManager = new BotManager();
}

export const botManager = globalForMc.__dastiarBotManager;
export { BLOCK_MAP };
