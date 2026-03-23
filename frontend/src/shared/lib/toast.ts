"use client";

import { dismissToast, pushToast, updateToast, type ToastPayload, type ToastTone } from "./toast-store";

type PromiseToastConfig = {
  loading: ToastPayload;
  success: ToastPayload;
  error: ToastPayload;
};

export function showToast(input: ToastPayload & { tone?: ToastTone; durationMs?: number; persistent?: boolean }) {
  return pushToast(input);
}

export function successToast(title: string, description?: string) {
  return showToast({
    tone: "success",
    title,
    description
  });
}

export function errorToast(title: string, description?: string) {
  return showToast({
    tone: "error",
    title,
    description,
    durationMs: 4200
  });
}

export function infoToast(title: string, description?: string) {
  return showToast({
    tone: "info",
    title,
    description
  });
}

export async function runWithToast<T>(promise: Promise<T>, config: PromiseToastConfig) {
  const toastId = showToast({
    tone: "loading",
    title: config.loading.title,
    description: config.loading.description,
    persistent: true
  });

  try {
    const result = await promise;

    updateToast(toastId, {
      tone: "success",
      title: config.success.title,
      description: config.success.description,
      durationMs: 2800,
      persistent: false
    });

    return result;
  } catch (error) {
    updateToast(toastId, {
      tone: "error",
      title: config.error.title,
      description: config.error.description,
      durationMs: 4200,
      persistent: false
    });

    throw error;
  }
}

export { dismissToast };
