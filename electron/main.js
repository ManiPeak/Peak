/**
 * پیکربندی Electron — پنجرهٔ دسکتاپ مستقل «Peak» — بدون نیاز به مرورگر
 *
 * معماری: پنجرهٔ Electron خودش کل برنامه را نشان می‌دهد؛ سرور Next.js با یک
 * فرایند Node جدا (فرزند) اجرا می‌شود و UI داخل همان پنجره باز می‌شود.
 * Node از این ترتیب انتخاب می‌گردد:
 *   ۱. Node قابل‌حمل داخل بسته (resources/node/node.exe) — بدون پیش‌نیاز
 *   ۲. Node سیستم (PATH) — برای اجرای از روی سورس
 */
const { app, BrowserWindow, shell, dialog, session } = require("electron");
const { spawn } = require("child_process");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");

const APP_NAME = "Peak";
const PREFERRED_PORT = 3784;

/* ---------------- ثبت لاگ (برای دیباگ نصب و پرتابل) ----------------
 * تمام خطاهای برنامه و خروجی سرور داخل فایل نوشته می‌شوند تا اگر
 * برنامه باز نشد، فایل لاگ را بفرستی و مشکل دقیق مشخص شود. */

let logFilePath = null;

function logLine(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  try {
    if (logFilePath) fs.appendFileSync(logFilePath, line + "\r\n");
  } catch {
    /* نادیده */
  }
}

function initLog() {
  try {
    const dir = app.isPackaged
      ? path.join(app.getPath("userData"), "data")
      : path.join(__dirname, "..", "data");
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, "peak-log.txt");
    logLine("info", `==== ${APP_NAME} start ====`);
    logLine("info", `exe: ${process.execPath}`);
    logLine("info", `argv: ${process.argv.join(" ")}`);
    logLine("info", `portable: ${process.env.PORTABLE_EXECUTABLE_FILE ? "yes" : "no"}`);
    logLine("info", `resourcesPath: ${process.resourcesPath}`);
    return dir;
  } catch (e) {
    console.error("log init failed:", e);
    return null;
  }
}

// هیچ خطایی بی‌صدا نماند — همه ثبت و به کاربر نشان داده می‌شود
process.on("uncaughtException", (err) => {
  logLine("FATAL", `uncaughtException: ${err?.stack || err}`);
  try {
    dialog.showErrorBox(
      APP_NAME,
      `خطای غیرمنتظره:\n${err?.message || err}\n\nلاگ: ${logFilePath || "نامشخص"}`
    );
  } catch {
    /* نادیده */
  }
});
process.on("unhandledRejection", (reason) => {
  logLine("ERROR", `unhandledRejection: ${reason}`);
});

// پشتیبانی از سوییچ --no-sandbox (برای محیط‌های مجازی/سندباکس)
if (process.argv.includes("--no-sandbox")) {
  app.commandLine.appendSwitch("no-sandbox");
}

let serverProcess = null;
let mainWindow = null;
let serverPort = PREFERRED_PORT;
let quitting = false;

/* ---------------- تک‌نمونه بودن برنامه ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/* ---------------- مسیرهای پایه ---------------- */

/** ریشهٔ برنامه — در حالت بسته‌بندی داخل پوشهٔ app منابع */
function getAppRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
}

/** پوشهٔ داده‌های قابل‌نوشتن (دیتابیس + مدل‌های صوتی) */
function getDataDir() {
  const dir = app.isPackaged
    ? path.join(app.getPath("userData"), "data")
    : path.join(getAppRoot(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** مسیر اجرای Node — اول Node قابل حمل داخل بسته، بعد Node سیستم */
function getNodeBinary() {
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, "node", "node.exe");
    if (fs.existsSync(bundled)) {
      logLine("info", `using bundled node: ${bundled}`);
      return bundled;
    }
    logLine("warn", `bundled node NOT FOUND at: ${bundled} — falling back to system node`);
  }
  return "node";
}

/** پیدا کردن پورت آزاد نزدیک پورت دلخواه */
function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > start + 20) return reject(new Error("پورت آزاد پیدا نشد."));
      const srv = net.createServer();
      srv.once("error", () => tryPort(port + 1));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port, "127.0.0.1");
    };
    tryPort(start);
  });
}

/** صبر تا سرور برنامه آماده شود */
function waitForServer(port, retries = 90) {
  return new Promise((resolve, reject) => {
    const check = (left) => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (left <= 0) return reject(new Error("سرور برنامه آماده نشد."));
        setTimeout(() => check(left - 1), 1000);
      });
    };
    check(retries);
  });
}

/* ---------------- اجرای سرور Next.js ---------------- */

function startServer() {
  const appRoot = getAppRoot();
  const nodeBin = getNodeBinary();
  const nextBin = path.join(
    appRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  if (!fs.existsSync(nextBin)) {
    dialog.showErrorBox(
      APP_NAME,
      "فایل‌های برنامه ناقص‌اند (next پیدا نشد). لطفاً برنامه را دوباره نصب کنید."
    );
    app.quit();
    return;
  }

  const dataDir = initLog() || getDataDir();
  logLine("info", `node: ${nodeBin}`);
  logLine("info", `appRoot: ${appRoot}`);
  logLine("info", `dataDir: ${dataDir}`);

  // سقف رم از تنظیمات برنامه (data/peak-config.json) — «رمی که بهش می‌دهی»
  let ramMB = 512;
  try {
    const cfgPath = path.join(dataDir, "peak-config.json");
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (typeof cfg.appRamMB === "number" && cfg.appRamMB >= 256 && cfg.appRamMB <= 8192) {
        ramMB = cfg.appRamMB;
      }
    }
  } catch {
    /* از پیش‌فرض استفاده کن */
  }
  logLine("info", `RAM cap: ${ramMB}MB (from settings)`);

  // مهم: stdio لوله‌ای + windowsHide تا پنجرهٔ سیاه shell باز نشود (باگ «error shell»)
  // و خروجی سرور داخل لاگ نوشته شود (دیباگ نصب/پرتابل)
  serverProcess = spawn(nodeBin, [nextBin, "start", "-p", String(serverPort)], {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      // بهینه‌سازی مصرف: سقف حافظه از تنظیمات برنامه، نخ‌های کم، بدون تله‌متری
      NODE_OPTIONS: `--max-old-space-size=${ramMB}`,
      UV_THREADPOOL_SIZE: "2",
      NEXT_TELEMETRY_DISABLED: "1",
      // دیتابیس، مدل‌های صوتی و کش vosk در پوشهٔ قابل‌نوشتن کاربر ذخیره می‌شوند
      DASTIAR_DB_PATH: path.join(dataDir, "app_db.sqlite"),
      DASTIAR_MODELS_DIR: path.join(dataDir, "models"),
      DASTIAR_VENDOR_DIR: path.join(dataDir, "vendor")
    }
  });

  serverProcess.stdout?.on("data", (buf) => {
    logLine("srv", String(buf).trimEnd());
  });
  serverProcess.stderr?.on("data", (buf) => {
    logLine("srv-err", String(buf).trimEnd());
  });

  serverProcess.on("error", (err) => {
    logLine("FATAL", `spawn error: ${err?.stack || err}`);
    dialog.showErrorBox(
      APP_NAME,
      `اجرای سرور برنامه ممکن نشد:\n${err?.message || err}\n\nلاگ: ${logFilePath || "نامشخص"}`
    );
    app.quit();
  });

  serverProcess.on("exit", (code) => {
    logLine("info", `server exited with code ${code}`);
    if (!quitting && code !== 0 && code !== null) {
      dialog.showErrorBox(
        APP_NAME,
        `سرور برنامه با کد ${code} بسته شد.\nفایل لاگ را بفرستید تا مشکل دقیق مشخص شود:\n${logFilePath || "نامشخص"}`
      );
      app.quit();
    }
  });
}

/* ---------------- پنجرهٔ برنامه ---------------- */

const SPLASH_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html dir="rtl" lang="fa">
<head><meta charset="utf-8">
<style>
  html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
    background:radial-gradient(ellipse 80% 50% at 20% -10%, rgba(96,165,250,.18), transparent),
               radial-gradient(ellipse 60% 40% at 90% 110%, rgba(167,139,250,.16), transparent),
               #070b14;
    color:#e2e8f0;font-family:Segoe UI,Tahoma,sans-serif}
  .tile{width:96px;height:96px;border-radius:28px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#22d3ee,#818cf8);box-shadow:0 0 60px rgba(34,211,238,.45)}
  h1{font-size:22px;margin:0;letter-spacing:.35em}
  p{color:#94a3b8;font-size:13px;margin:0}
  .bar{width:180px;height:4px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
  .bar i{display:block;height:100%;width:40%;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#a78bfa);
    animation:slide 1.1s ease-in-out infinite alternate}
  @keyframes slide{from{transform:translateX(0)}to{transform:translateX(160%)}}
</style></head>
<body>
  <div class="tile">
    <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
      <path d="M16 4.5L28.5 27.5H3.5L16 4.5Z" fill="#0b1220"/>
      <path d="M16 4.5L21.8 15H10.2L16 4.5Z" fill="#e2e8f0"/>
      <path d="M23 27.5L27 19L31 27.5H23Z" fill="#0b1220" opacity="0.55"/>
      <circle cx="24.2" cy="8.2" r="2.6" fill="#fbbf24"/>
    </svg>
  </div>
  <h1>PEAK</h1>
  <div class="bar"><i></i></div>
  <p>در حال آماده‌سازی برنامه…</p>
</body>
</html>`)}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: "#070b14",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  // اسپلش تا آماده شدن سرور
  mainWindow.loadURL(SPLASH_HTML);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // اجازهٔ میکروفون/صدا برای گوی صوتی و تشخیص گفتار
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      const allowed = new Set([
        "media",
        "fullscreen",
        "clipboard-sanitized-read",
        "pointerLock",
        "display-capture",
        "notifications"
      ]);
      callback(allowed.has(permission));
    }
  );

  // لینک‌های خارجی → مرورگر پیش‌فرض؛ ماندن در خود برنامه
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const appUrl = `http://127.0.0.1:${serverPort}`;
    if (!url.startsWith(appUrl) && !url.startsWith("http://localhost")) {
      event.preventDefault();
      if (url.startsWith("http")) shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* ---------------- چرخهٔ حیات ---------------- */

if (gotLock) {
  app.whenReady().then(async () => {
    app.setAppUserModelId("com.peak.desktop");

    try {
      serverPort = await findFreePort(PREFERRED_PORT);
    } catch {
      serverPort = PREFERRED_PORT;
    }

    startServer();
    createWindow();

    try {
      await waitForServer(serverPort);
      if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
    } catch (err) {
      logLine("FATAL", `waitForServer: ${err?.message || err}`);
      dialog.showErrorBox(
        APP_NAME,
        `سرور برنامه آماده نشد.\n${err?.message || err}\n\nفایل لاگ (بفرستید تا مشکل حل شود):\n${logFilePath || "نامشخص"}`
      );
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    if (serverProcess) serverProcess.kill();
  });
}
