"use client";

/**
 * صفحهٔ مکالمهٔ صوتی — گوی نئونی، امواج صدا، تشخیص گفتار فارسی، Barge-in
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Loader2, Send } from "lucide-react";
import { Btn, Field, PageTitle, Toggle } from "@/components/ui";
import {
  apiGet,
  createSpeechStream,
  isSpeaking,
  listVoices,
  stopSpeaking
} from "@/lib/client";
import { hasPermission } from "@/lib/permissions";
import { EmergencyStop } from "@/components/EmergencyStop";
import type { PublicSettings } from "@/lib/types";
import { startStt, type SttSession } from "@/lib/stt";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [continuous, setContinuous] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [chatText, setChatText] = useState("");

  const recognitionRef = useRef<SttSession | null>(null);
  const shouldListenRef = useRef(false);
  const activeIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---------------- تنظیمات ---------------- */

  useEffect(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => {
        setSettings(d.settings);
        if (d.settings.microphoneId) {
          // شناسهٔ میکروفون انتخاب‌شده برای مجوز
        }
      })
      .catch(() => undefined);
    void listVoices();
  }, []);

  /* ---------------- میکروفون و امواج ---------------- */

  const setupAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(avg / 128);

        // رسم امواج روی canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return;
        const { width, height } = canvas;
        ctx2d.clearRect(0, 0, width, height);
        const bars = 28;
        const gap = width / bars;
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor((i / bars) * data.length)] / 255;
          const h = Math.max(4, v * height * 0.85);
          const gradient = ctx2d.createLinearGradient(0, height, 0, height - h);
          gradient.addColorStop(0, "rgba(34, 211, 238, 0.85)");
          gradient.addColorStop(1, "rgba(167, 139, 250, 0.9)");
          ctx2d.fillStyle = gradient;
          ctx2d.beginPath();
          ctx2d.roundRect(i * gap + 2, height - h, gap - 5, h, 4);
          ctx2d.fill();
        }
      };
      draw();
    } catch {
      setError("دسترسی به میکروفون داده نشد. مجوز مرورگر رو چک کن.");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  /* ---------------- تشخیص گفتار + Barge-in ---------------- */

  const processTranscript = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      // Barge-in: اگر دستیار داره حرف می‌زنه، فوراً قطع کن
      if (isSpeaking()) {
        stopSpeaking();
      }

      setMessages((prev) => [...prev, { role: "user", text: clean }]);
      setInterim("");
      setState("thinking");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeIdRef.current,
            content: clean
          })
        });

        // پاسخ خطا باید دیده شود — قبلاً بی‌صدا یک پیام خالی نمایش داده می‌شد
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          const message =
            data.error ?? `خطای سرور (HTTP ${res.status}). ارتباط با بک‌اند برقرار نشد.`;
          setError(message);
          setState(shouldListenRef.current ? "listening" : "idle");
          return;
        }

        const convId = Number(res.headers.get("X-Conversation-Id"));
        if (convId) activeIdRef.current = convId;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let full = "";
        // گفتار بدون تأخیر: هر جمله به محض آماده شدن پخش می‌شود
        const tts =
          !muted && settings && hasPermission(settings, "ttsAuto")
            ? createSpeechStream(settings)
            : null;
        if (tts) setState("speaking");
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            full += chunk;
            tts?.push(chunk);
          }
        }
        tts?.finish();

        setMessages((prev) => [...prev, { role: "assistant", text: full }]);
        if (tts) {
          // پایان پخش → ادامهٔ شنیدن در حالت پیوسته
          const checkEnd = setInterval(() => {
            if (!isSpeaking()) {
              clearInterval(checkEnd);
              setState(shouldListenRef.current ? "listening" : "idle");
            }
          }, 300);
        } else {
          setState(shouldListenRef.current ? "listening" : "idle");
        }
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? `ارتباط با دستیار برقرار نشد: ${err.message}`
            : "ارتباط با دستیار برقرار نشد."
        );
        setState(shouldListenRef.current ? "listening" : "idle");
      }
    },
    [muted, settings]
  );

  const startListening = useCallback(() => {
    // گیت دسترسی میکروفون
    if (settings && !hasPermission(settings, "mic")) {
      setError("🔒 دسترسی «میکروفون» بسته است. از بخش دسترسی‌ها می‌توانی بازش کنی.");
      return;
    }
    stopSpeaking();
    shouldListenRef.current = true;
    void setupAudio();
    setState("listening");
    setError(null);

    // Barge-in: به محض حرف زدن کاربر، صدا قطع می‌شود
    const bargeIn = () => {
      if (isSpeaking()) {
        stopSpeaking();
        setState("listening");
      }
    };

    void startStt(
      {
        onInterim: (t) => {
          bargeIn();
          if (shouldListenRef.current) setInterim(t);
        },
        onFinal: (t) => {
          bargeIn();
          setInterim("");
          if (shouldListenRef.current) void processTranscript(t);
        },
        onError: (m) => {
          setError(m);
          shouldListenRef.current = false;
          setState("idle");
        },
        onEnd: () => {
          if (!shouldListenRef.current) setState("idle");
        },
        onStatus: (m) => {
          if (shouldListenRef.current) setInterim(m);
        }
      },
      { autoRestart: continuous }
    )
      .then((session) => {
        if (!session) {
          if (shouldListenRef.current) {
            setError("تشخیص گفتار در دسترس نیست.");
          }
          shouldListenRef.current = false;
          setState("idle");
          return;
        }
        recognitionRef.current = session;
        if (!shouldListenRef.current) session.stop();
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "راه‌اندازی میکروفون ناموفق بود."
        );
        shouldListenRef.current = false;
        setState("idle");
      });
  }, [continuous, processTranscript, setupAudio, settings]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopSpeaking();
    setState("idle");
    setInterim("");
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // کلید اضطراری: قطع فوری میکروفون و صدا
  useEffect(() => {
    const onEmergency = () => stopListening();
    window.addEventListener("peak:emergency", onEmergency);
    return () => window.removeEventListener("peak:emergency", onEmergency);
  }, [stopListening]);

  // وقتی continuous تغییر کرد و در حال شنیدن هستیم، ری‌استارت
  useEffect(() => {
    if (state === "listening" && !continuous) {
      // شنیدن تک‌نوبتی بعد از هر پاسخ متوقف می‌شود
    }
  }, [continuous, state]);

  /* ---------------- رندر ---------------- */

  const orbScale = 1 + level * 0.35;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="مکالمهٔ صوتی"
          subtitle="حرف بزن؛ اگه وسط صحبت دستیار هم حرف بزنی، فوراً گوش می‌ده (Barge-in)."
        />
        <EmergencyStop inline />
      </div>

      {/* گوی نئونی */}
      <button
        onClick={() => (state === "idle" ? startListening() : stopListening())}
        className="relative my-8 flex h-52 w-52 items-center justify-center rounded-full transition-transform duration-100"
        style={{ transform: `scale(${orbScale})` }}
      >
        <div
          className={`voice-orb absolute inset-0 rounded-full transition-all duration-300 ${
            state === "listening"
              ? "animate-orb-pulse"
              : state === "speaking"
                ? "opacity-90"
                : "opacity-70"
          }`}
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          {state === "thinking" ? (
            <Loader2 size={36} className="animate-spin text-white" />
          ) : state === "listening" ? (
            <Mic size={36} className="text-white drop-shadow" />
          ) : state === "speaking" ? (
            <Volume2 size={36} className="text-white drop-shadow" />
          ) : (
            <MicOff size={36} className="text-white/80" />
          )}
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-white">
            {state === "idle"
              ? "برای شروع لمس کن"
              : state === "listening"
                ? "دارم گوش می‌دم..."
                : state === "thinking"
                  ? "در حال فکر کردن..."
                  : "دارم حرف می‌زنم..."}
          </span>
        </div>
      </button>

      {/* امواج صدا */}
      <canvas
        ref={canvasRef}
        width={560}
        height={90}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5"
      />

      {/* متن در حال تشخیص */}
      {interim ? (
        <p className="mt-4 w-full max-w-xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span className="text-xs text-slate-500">در حال شنیدن: </span>
          {interim}
          <span className="typing-caret" />
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 w-full max-w-xl rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {/* کنترل‌ها */}
      <div className="mt-6 grid w-full max-w-xl gap-3">
        <Toggle
          checked={continuous}
          onChange={setContinuous}
          label="مکالمهٔ پیوسته (بعد از هر پاسخ، دوباره گوش بده)"
        />
        <Toggle
          checked={muted}
          onChange={(v) => {
            setMuted(v);
            if (v) stopSpeaking();
          }}
          label="بی‌صدا (فقط متن، بدون پخش پاسخ)"
        />
      </div>

      {/* چت متنی — وقتی تلفظ خراب شد، بنویس */}
      <div className="mt-8 w-full max-w-xl">
        <h2 className="mb-2 text-sm font-bold text-slate-300">
          ✍️ چت متنی — اگر تلفظت خراب شد، بنویس
        </h2>
        <div className="flex gap-2">
          <Field
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatText.trim()) {
                void processTranscript(chatText.trim());
                setChatText("");
              }
            }}
            placeholder="اینجا بنویس... مثلاً: وود پمپ کن"
          />
          <Btn
            onClick={() => {
              if (chatText.trim()) {
                void processTranscript(chatText.trim());
                setChatText("");
              }
            }}
            disabled={!chatText.trim()}
          >
            <Send size={16} className="-scale-x-100" />
          </Btn>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          همهٔ دستورها با متن هم کار می‌کنن — دقیقاً مثل حرف زدن.
        </p>
      </div>

      {/* رونوشت گفتگو */}
      <div className="mt-8 w-full max-w-xl">
        <h2 className="mb-3 text-sm font-bold text-slate-300">رونوشت مکالمه</h2>
        <div className="glass max-h-96 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-slate-500">
              هنوز مکالمه‌ای شروع نشده.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-2.5 text-sm leading-6 ${
                  m.role === "user"
                    ? "bubble-user mr-auto max-w-[85%]"
                    : "bubble-assistant ml-auto max-w-[85%]"
                }`}
              >
                <p className="mb-1 text-[10px] opacity-70">
                  {m.role === "user" ? "تو" : "دستیار"}
                </p>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
