#!/usr/bin/env tsx
// Peak 1.0.3 — Consolidated CLI (diagnose+sync-db -> 1). Usage: tsx scripts/cli.ts <diagnose|sync-db> [args]
// The subcommand is spliced out of argv so wrapped code sees original argv shape.
import { runDiagnostics, STATUS_LABEL } from "@/lib/diagnostics";
import type { DiagnosticsReport } from "@/lib/diagnostics";
import { isProviderId } from "@/lib/providers";
import type { ProviderCheck } from "@/lib/providers";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/* ===== sync-db (wrapped) ===== */
function syncDb(): void {
/**
 * همگام‌سازی دیتابیس — ساخت جدول‌ها و تنظیمات پیش‌فرض
 * اجرا: npm run db:sync
 */

const DB_PATH =
  process.env.DASTIAR_DB_PATH ?? path.join(process.cwd(), "data", "app_db.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const raw = new Database(DB_PATH);
raw.pragma("foreign_keys = ON");
raw.pragma("journal_mode = WAL");

raw.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'گفتگوی جدید',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    meta TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 25565,
    version TEXT NOT NULL DEFAULT 'auto',
    auth TEXT NOT NULL DEFAULT 'offline',
    username TEXT,
    last_status TEXT NOT NULL DEFAULT 'never',
    last_connected_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// درج تنظیمات پیش‌فرض اگر وجود نداشته باشد
const existing = raw
  .prepare("SELECT value FROM settings WHERE key = 'app'")
  .get();
if (!existing) {
  raw
    .prepare("INSERT INTO settings (key, value) VALUES ('app', ?)")
    .run(JSON.stringify({ autoMemory: true }));
}

raw.close();
console.log(`✅ دیتابیس آماده است: ${DB_PATH}`);
}

/* ===== diagnose ===== */
/**
 * تشخیص خط فرمان — همان بررسی‌های /api/diagnostics، بدون نیاز به مرورگر.
 *
 *   npm run diagnose
 *   npm run diagnose -- --provider ollama
 *   npm run diagnose -- --provider openrouter --model openai/gpt-4o-mini
 *   npm run diagnose -- --provider ollama --base-url http://127.0.0.1:11434
 *
 * کلید API از متغیر محیطی یا تنظیمات ذخیره‌شده خوانده می‌شود
 * (مثلاً OPENROUTER_API_KEY یا OLLAMA_BASE_URL) و هرگز چاپ نمی‌شود.
 *
 * کد خروج: 0 = همه PASS/NOT_TESTED، 1 = حداقل یک FAIL
 */

/* ---------------- خواندن آرگومان‌ها ---------------- */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const providerArg = arg("provider");
if (providerArg && !isProviderId(providerArg)) {
  console.error(`شناسهٔ ارائه‌دهنده نامعتبر است: ${providerArg}`);
  console.error("مقادیر مجاز: builtin, ollama, openrouter, openai, groq, xai, lmstudio, 9router, custom");
  process.exit(2);
}

const override = {
  provider: isProviderId(providerArg) ? providerArg : undefined,
  baseUrl: arg("base-url"),
  model: arg("model")
};

/* ---------------- رنگ ---------------- */
const color = process.stdout.isTTY;
const c = {
  green: (s: string) => (color ? `\u001b[32m${s}\u001b[0m` : s),
  red: (s: string) => (color ? `\u001b[31m${s}\u001b[0m` : s),
  yellow: (s: string) => (color ? `\u001b[33m${s}\u001b[0m` : s),
  gray: (s: string) => (color ? `\u001b[90m${s}\u001b[0m` : s),
  bold: (s: string) => (color ? `\u001b[1m${s}\u001b[0m` : s)
};

function paint(status: ProviderCheck["status"], text: string): string {
  if (status === "PASS") return c.green(text);
  if (status === "FAIL") return c.red(text);
  if (status === "NOT_TESTED") return c.yellow(text);
  return c.gray(text);
}

function report(r: DiagnosticsReport): void {
  const line = "─".repeat(72);
  console.log(c.bold("\n⛰️  Peak — گزارش تشخیص\n"));
  console.log(`${c.bold("ارائه‌دهنده:")} ${r.provider.label} (${r.provider.id})`);
  console.log(`${c.bold("آدرس پایه:")}  ${r.provider.baseUrl}  ${c.gray(`(${r.provider.sources.baseUrl})`)}`);
  console.log(`${c.bold("مدل:")}        ${r.provider.model}  ${c.gray(`(${r.provider.sources.model})`)}`);
  console.log(
    `${c.bold("کلید API:")}    ${r.provider.apiKeyMasked || c.gray("— ندارد —")}  ${c.gray(`(${r.provider.sources.apiKey})`)}`
  );
  console.log(
    `${c.bold("محیط:")}       نسخهٔ ${r.runtime.appVersion} · ${c.gray(r.runtime.node)} · ${r.runtime.platform} · uptime ${r.runtime.uptimeSec}s`
  );
  console.log(`${c.bold("دیتابیس:")}    ${c.gray(r.runtime.dbPath)}\n${line}`);

  for (const check of r.checks) {
    const label = STATUS_LABEL[check.status].padEnd(10);
    const ms = check.latencyMs !== undefined ? c.gray(` [${check.latencyMs}ms]`) : "";
    console.log(`${paint(check.status, label)} ${check.label}${ms}`);
    console.log(`           ${check.detail}`);
    if (check.hint) console.log(c.yellow(`           ↳ ${check.hint}`));
  }
  console.log(line);
  const s = r.summary;
  console.log(
    `نتیجه: ${c.green(`${s.pass} PASS`)} · ${s.fail ? c.red(`${s.fail} FAIL`) : "0 FAIL"} · ` +
      `${s.notTested ? c.yellow(`${s.notTested} NOT TESTED`) : "0 NOT TESTED"} · ${s.skipped} SKIPPED\n`
  );
}

async function main(): Promise<void> {
  try {
    const result = await runDiagnostics(override);
    report(result);
    process.exit(result.summary.fail > 0 ? 1 : 0);
  } catch (err) {
    console.error(c.red(`تشخیص اجرا نشد: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(2);
  }
}

/* dispatch below (1.0.3) */

/* ===== dispatch ===== */
const __cmd = process.argv[2];
if (__cmd === 'sync-db' || __cmd === 'diagnose') process.argv.splice(2, 1);
if (__cmd === 'sync-db') { syncDb(); }
else if (__cmd === 'diagnose' || __cmd === undefined) { void main(); }
else { console.error(`Unknown command: ${__cmd}. Use: diagnose | sync-db`); process.exit(2); }
