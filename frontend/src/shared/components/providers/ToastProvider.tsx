"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToToasts, type ToastRecord } from "@/src/shared/lib/toast-store";

function ToastIcon({ tone }: { tone: ToastRecord["tone"] }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="m5 12 4 4 10-10" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    );
  }

  if (tone === "loading") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function toneClasses(tone: ToastRecord["tone"]) {
  switch (tone) {
    case "success":
      return {
        shell: "from-[#0f6bdc] via-[#1586ff] to-[#37a1ff]",
        glow: "shadow-[0_22px_60px_rgba(20,104,220,0.34)]",
        icon: "bg-white/18 text-white",
        bar: "bg-white/80"
      };
    case "error":
      return {
        shell: "from-[#8b1f3a] via-[#c6284d] to-[#ef476f]",
        glow: "shadow-[0_22px_60px_rgba(198,40,77,0.34)]",
        icon: "bg-white/16 text-white",
        bar: "bg-white/80"
      };
    case "loading":
      return {
        shell: "from-[#14396f] via-[#1e5cc8] to-[#2c7dff]",
        glow: "shadow-[0_22px_60px_rgba(30,92,200,0.32)]",
        icon: "bg-white/16 text-white",
        bar: "bg-white/70"
      };
    default:
      return {
        shell: "from-[#19406f] via-[#2467c7] to-[#4898ff]",
        glow: "shadow-[0_22px_60px_rgba(36,103,199,0.28)]",
        icon: "bg-white/16 text-white",
        bar: "bg-white/75"
      };
  }
}

function ToastCard({ toast }: { toast: ToastRecord }) {
  const tone = toneClasses(toast.tone);

  return (
    <button
      type="button"
      onClick={() => dismissToast(toast.id)}
      className={`ssd-toast-enter group relative w-full overflow-hidden rounded-[1.6rem] border border-white/18 bg-gradient-to-br ${tone.shell} px-4 py-4 text-left text-white ${tone.glow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_34%)]" />
      <div className="relative flex items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
          <ToastIcon tone={toast.tone} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-[0.01em]">{toast.title}</div>
          {toast.description ? (
            <p className="mt-1 text-sm leading-6 text-white/88">{toast.description}</p>
          ) : null}
        </div>
        <div className="rounded-full border border-white/16 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
          SSD
        </div>
      </div>

      {!toast.persistent ? (
        <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/14">
          <div
            className={`ssd-toast-progress h-full origin-left rounded-full ${tone.bar}`}
            style={{ animationDuration: `${toast.durationMs}ms` }}
          />
        </div>
      ) : null}
    </button>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => subscribeToToasts(setToasts), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-5 sm:px-6">
      <div className="pointer-events-auto flex w-full max-w-[34rem] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}
