"use client";

export type ToastTone = "success" | "error" | "loading" | "info";

export interface ToastPayload {
  title: string;
  description?: string;
}

export interface ToastRecord extends ToastPayload {
  id: string;
  tone: ToastTone;
  durationMs: number;
  persistent?: boolean;
}

type Listener = (toasts: ToastRecord[]) => void;

const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let toasts: ToastRecord[] = [];

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function buildId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clearToastTimer(id: string) {
  const timer = timers.get(id);

  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function scheduleDismiss(id: string, durationMs: number) {
  clearToastTimer(id);

  const timer = setTimeout(() => {
    dismissToast(id);
  }, durationMs);

  timers.set(id, timer);
}

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);

  return () => {
    listeners.delete(listener);
  };
}

export function pushToast(input: ToastPayload & { tone?: ToastTone; durationMs?: number; persistent?: boolean }) {
  const id = buildId();
  const nextToast: ToastRecord = {
    id,
    tone: input.tone ?? "info",
    title: input.title,
    description: input.description,
    durationMs: input.durationMs ?? 3400,
    persistent: input.persistent ?? false
  };

  toasts = [nextToast, ...toasts].slice(0, 4);
  emit();

  if (!nextToast.persistent) {
    scheduleDismiss(id, nextToast.durationMs);
  }

  return id;
}

export function updateToast(
  id: string,
  input: Partial<ToastPayload> & { tone?: ToastTone; durationMs?: number; persistent?: boolean }
) {
  let found = false;

  toasts = toasts.map((toast) => {
    if (toast.id !== id) {
      return toast;
    }

    found = true;

    return {
      ...toast,
      title: input.title ?? toast.title,
      description: input.description ?? toast.description,
      tone: input.tone ?? toast.tone,
      durationMs: input.durationMs ?? toast.durationMs,
      persistent: input.persistent ?? toast.persistent
    };
  });

  if (!found) {
    return null;
  }

  emit();

  const target = toasts.find((toast) => toast.id === id);

  if (!target) {
    return null;
  }

  if (target.persistent) {
    clearToastTimer(id);
  } else {
    scheduleDismiss(id, target.durationMs);
  }

  return id;
}

export function dismissToast(id: string) {
  clearToastTimer(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function dismissAllToasts() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts = [];
  emit();
}
