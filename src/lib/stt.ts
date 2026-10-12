/**
 * لایهٔ یکپارچهٔ تشخیص گفتار فارسی
 *
 * اولویت اجرا:
 *   ۱. Web Speech API (Chrome/Edge) — دقیق و سریع
 *   ۲. موتور محلی vosk (WASM) — داخل پنجرهٔ برنامه/Electron، بدون مرورگر
 *      مدل صوتی فقط بار اول دانلود و کش می‌شود؛ بعدش کاملاً آفلاین
 */

export interface SttHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
  /** پیام وضعیت مثل «در حال آماده‌سازی موتور گفتار…» */
  onStatus?: (message: string) => void;
}

export interface SttSession {
  stop: () => void;
}

interface WebkitOptions {
  /** ادامهٔ شنیدن بعد از هر نتیجه */
  autoRestart: boolean;
}

/* ---------------- مسیر ۱: Web Speech API ---------------- */

function startWebkit(
  Recog: new () => SpeechRecognitionLike,
  handlers: SttHandlers,
  opts: WebkitOptions
): SttSession {
  let stopped = false;
  const recog = new Recog();
  recog.lang = "fa-IR";
  recog.continuous = true;
  recog.interimResults = true;

  recog.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interimText += r[0].transcript;
    }
    if (interimText) handlers.onInterim(interimText);
    if (finalText.trim()) handlers.onFinal(finalText);
  };

  recog.onerror = (e) => {
    if (e.error === "not-allowed") {
      handlers.onError("اجازهٔ میکروفون داده نشد.");
      stopped = true;
    }
  };

  recog.onend = () => {
    if (stopped || !opts.autoRestart) {
      handlers.onEnd?.();
      return;
    }
    try {
      recog.start();
    } catch {
      /* قبلاً شروع شده */
    }
  };

  try {
    recog.start();
  } catch {
    /* نادیده */
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recog.stop();
      } catch {
        /* نادیده */
      }
    }
  };
}

/* ---------------- مسیر ۲: موتور محلی vosk ---------------- */

interface VoskModelLike {
  KaldiRecognizer: new (sampleRate: number) => {
    on: (event: string, cb: (m: { result?: { text?: string; partial?: string } }) => void) => void;
    acceptWaveform: (buffer: AudioBuffer) => void;
    remove: () => void;
  };
}

let voskScriptPromise: Promise<void> | null = null;
let voskModelPromise: Promise<VoskModelLike> | null = null;

function loadVoskScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window در دسترس نیست"));
  }
  const w = window as unknown as { Vosk?: unknown };
  if (w.Vosk) return Promise.resolve();
  if (!voskScriptPromise) {
    voskScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/api/vendor/vosk"; // دانلود خودکار + کش دائمی (مثل مدل فارسی)
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("موتور گفتار بارگذاری نشد (vosk.js)"));
      document.head.appendChild(script);
    });
  }
  return voskScriptPromise;
}

async function getVoskModel(): Promise<VoskModelLike> {
  if (!voskModelPromise) {
    voskModelPromise = (async () => {
      await loadVoskScript();
      const Vosk = (window as unknown as {
        Vosk: { createModel: (url: string) => Promise<VoskModelLike> };
      }).Vosk;
      return await Vosk.createModel("/api/models/fa");
    })().catch((err) => {
      voskModelPromise = null; // اجازهٔ تلاش دوباره
      throw err;
    });
  }
  return voskModelPromise;
}

async function startVosk(handlers: SttHandlers): Promise<SttSession> {
  handlers.onStatus?.("در حال آماده‌سازی موتور گفتار… (بار اول ممکن است چند لحظه طول بکشد)");
  const model = await getVoskModel();
  handlers.onStatus?.("");

  const recognizer = new model.KaldiRecognizer(16000);
  recognizer.on("partialresult", (m) => {
    const partial = m.result?.partial ?? "";
    if (partial) handlers.onInterim(partial);
  });
  recognizer.on("result", (m) => {
    const text = (m.result?.text ?? "").trim();
    if (text) handlers.onFinal(text);
    else handlers.onInterim("");
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const pump = ctx.createScriptProcessor(4096, 1, 1);
  // مقصد بی‌صدا تا زنجیرهٔ صدا فعال بماند بدون فیدبک بلندگو
  const mute = ctx.createGain();
  mute.gain.value = 0;

  let stopped = false;
  pump.onaudioprocess = (event) => {
    if (stopped) return;
    try {
      recognizer.acceptWaveform(event.inputBuffer);
    } catch {
      /* نادیده */
    }
  };

  source.connect(pump);
  pump.connect(mute);
  mute.connect(ctx.destination);

  return {
    stop: () => {
      stopped = true;
      try {
        recognizer.remove();
      } catch {
        /* نادیده */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    }
  };
}

/* ---------------- ورودی عمومی ---------------- */

export async function startStt(
  handlers: SttHandlers,
  opts: WebkitOptions = { autoRestart: false }
): Promise<SttSession | null> {
  const Recog =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (Recog) return startWebkit(Recog, handlers, opts);
  try {
    return await startVosk(handlers);
  } catch (err) {
    handlers.onError(
      err instanceof Error
        ? `موتور گفتار آماده نشد: ${err.message}`
        : "موتور گفتار آماده نشد."
    );
    return null;
  }
}

/** آیا تشخیص گفتار در این محیط ممکن است؟ */
export function sttAvailable(): boolean {
  return !!(
    typeof window !== "undefined" &&
    (window.SpeechRecognition ??
      window.webkitSpeechRecognition ??
      (undefined as unknown))
  );
}
