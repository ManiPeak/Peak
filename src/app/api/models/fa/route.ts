/**
 * مدل گفتار فارسی (vosk) — دانلود یک‌بار، کش دائمی، سرویس به موتور گفتار
 *
 * موتور vosk داخل خود برنامه (WASM) اجرا می‌شود و نیازی به مرورگر/سرویس خارجی ندارد.
 * این مسیر فقط فایل مدل را یک بار از اینترنت می‌گیرد و در دیسک نگه می‌دارد؛
 * از آن به بعد تشخیص گفتار کاملاً آفلاین کار می‌کند.
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const REMOTE_URL =
  "https://alphacephei.com/vosk/models/vosk-model-small-fa-0.5.zip";
const MODEL_FILE = "vosk-model-small-fa-0.5.zip";

/** پوشهٔ نگهداری مدل‌ها — در بستهٔ نصبی، پوشهٔ قابل‌نوشتن کاربر */
function modelsDir(): string {
  return (
    process.env.DASTIAR_MODELS_DIR ??
    path.join(process.cwd(), "data", "models")
  );
}

export async function GET(): Promise<Response> {
  const dir = modelsDir();
  const file = path.join(dir, MODEL_FILE);

  // اگر قبلاً دانلود شده → همان را بفرست
  if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000) {
    const data = fs.readFileSync(file);
    return new Response(data, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  // دانلود یک‌بار و ذخیرهٔ اتمی
  try {
    const res = await fetch(REMOTE_URL);
    if (!res.ok) {
      return new Response("دانلود مدل ناموفق بود", { status: 502 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000_000) {
      return new Response("فایل مدل ناقص است", { status: 502 });
    }
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.part`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, file);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("دانلود مدل ناموفق بود", { status: 502 });
  }
}
