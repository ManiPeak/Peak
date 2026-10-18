/**
 * موتور گفتار vosk (vosk.js) — دانلود یک‌بار، کش دائمی، سرویس به موتور گفتار
 *
 * چرا این مسیر؟ فایل vosk.js حدود ۵.۶ مگابایت است و آپلود آن روی گیت‌هاب
 * کند/ناتمام می‌شود؛ پس از مخزن حذف شد و برنامه مثل مدل فارسی، آن را
 * یک بار از اینترنت می‌گیرد و در دیسک نگه می‌دارد (بعداً کاملاً آفلاین).
 */
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const FILE_NAME = "vosk.js";
const REMOTE_URLS = [
  "https://unpkg.com/vosk-browser@0.0.8/dist/vosk.js",
  "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js"
];

/** پوشهٔ کش قابل‌نوشتن — مثل پوشهٔ مدل‌ها */
function vendorDir(): string {
  return (
    process.env.DASTIAR_VENDOR_DIR ?? path.join(process.cwd(), "data", "vendor")
  );
}

function serveJs(data: Buffer): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

async function downloadVosk(): Promise<Buffer | null> {
  for (const url of REMOTE_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // سالم‌سنجی: باید واقعاً کتابخانهٔ vosk باشد
      if (buf.length > 500_000 && buf.includes("createModel")) return buf;
    } catch {
      /* آینهٔ بعدی */
    }
  }
  return null;
}

export async function GET(): Promise<Response> {
  const dir = vendorDir();
  const file = path.join(dir, FILE_NAME);

  // ۱. کش دیسک
  if (fs.existsSync(file) && fs.statSync(file).size > 500_000) {
    return serveJs(fs.readFileSync(file));
  }

  // ۲. اگر فایل قدیمی داخل public/vendor مانده، همان را کش کن
  const bundled = path.join(process.cwd(), "public", "vendor", FILE_NAME);
  if (fs.existsSync(bundled) && fs.statSync(bundled).size > 500_000) {
    const data = fs.readFileSync(bundled);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, data);
    } catch {
      /* فقط سرویس بده */
    }
    return serveJs(data);
  }

  // ۳. دانلود یک‌بار از اینترنت + کش دائمی
  const downloaded = await downloadVosk();
  if (!downloaded) {
    return new Response(
      "دانلود موتور گفتار (vosk.js) ممکن نشد. یک‌بار اینترنت لازم است؛ بعداً کاملاً آفلاین کار می‌کند.",
      { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, downloaded);
  } catch {
    /* فقط سرویس بده */
  }
  return serveJs(downloaded);
}
