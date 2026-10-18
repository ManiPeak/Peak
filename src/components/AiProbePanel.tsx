"use client";

/**
 * پنل «تست API هوش مصنوعی» — فهرست سرویس‌ها + تست زنده + تشخیص نام هوش مصنوعی
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Radar, Sparkles } from "lucide-react";
import { Btn, Card, Field, Label } from "@/components/ui-kit";
import { apiGet, apiSend } from "@/lib/client";
import type { AiCatalogEntry } from "@/lib/ai-core";
import type { AiProbeResult } from "@/lib/ai-core";

export default function AiProbePanel() {
  const [catalog, setCatalog] = useState<AiCatalogEntry[]>([]);
  const [keyInput, setKeyInput] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<AiProbeResult | null>(null);

  useEffect(() => {
    void apiGet<{ catalog: AiCatalogEntry[] }>("/api/ai-probe").then((d) => {
      if (d.catalog) setCatalog(d.catalog);
    });
  }, []);

  const probe = useCallback(
    async (id: string, url: string, model: string, needsKey: boolean) => {
      setBusyId(id);
      setResult(null);
      try {
        const r = await apiSend<AiProbeResult>("/api/ai-probe", "POST", {
          url,
          model,
          apiKey: needsKey ? keyInput : ""
        });
        setResult(r);
      } catch (e) {
        setResult({
          ok: false,
          aiName: "نامشخص",
          model: "",
          latencyMs: 0,
          message: e instanceof Error ? e.message : "تست ناموفق بود.",
          needsKey: false
        });
      } finally {
        setBusyId(null);
      }
    },
    [keyInput]
  );

  return (
    <Card className="mb-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
        <Radar size={18} className="text-neon-cyan" /> تست API هوش مصنوعی
        <span className="text-xs font-normal text-slate-400">
          — بگو از کدوم هوش مصنوعی است ⚡
        </span>
      </h2>

      <div className="mb-4 grid gap-3">
        <div>
          <Label>کلید API (برای سرویس‌هایی که کلید می‌خواهند — پولینیشن بدون کلید)</Label>
          <Field
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-... (اختیاری)"
          />
        </div>
        <div>
          <Label>تست یک URL دلخواه</Label>
          <div className="flex gap-2">
            <Field
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
            <Btn
              onClick={() =>
                void probe("custom", customUrl, "", keyInput.length > 0)
              }
              disabled={!customUrl || busyId === "custom"}
            >
              {busyId === "custom" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              تست
            </Btn>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            result.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          <b>{result.ok ? "✅ " : "❌ "}</b>
          {result.message}
          {result.ok && (
            <div className="mt-1 text-xs text-slate-300">
              مدل: <b>{result.model}</b> | تاخیر: <b>{result.latencyMs}ms</b> |
              هوش مصنوعی: <b>{result.aiName}</b>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-right text-xs text-slate-400">
              <th className="py-2">نام هوش مصنوعی</th>
              <th>مدل</th>
              <th>تاخیر</th>
              <th>ماینکرفت</th>
              <th>گفتار</th>
              <th>کلید</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {catalog.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="py-2 text-white">
                  {c.faName}
                  <div className="text-[10px] text-slate-500">{c.enName}</div>
                </td>
                <td className="text-slate-300">{c.model}</td>
                <td className="text-slate-300">{c.latency}</td>
                <td className="text-amber-300">{c.minecraft}</td>
                <td className="text-cyan-300">{c.speech}</td>
                <td className="text-xs text-slate-400">
                  {c.needsKey ? c.keyEnv : "بدون کلید ✓"}
                </td>
                <td>
                  <Btn
                    onClick={() =>
                      void probe(c.id, c.endpoint, c.model, c.needsKey)
                    }
                    disabled={busyId === c.id}
                  >
                    {busyId === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    تست
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
