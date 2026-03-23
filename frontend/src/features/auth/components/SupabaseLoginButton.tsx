"use client";

import { useState } from "react";
import { createClient } from "@/src/shared/lib/supabase/client";
import { errorToast } from "@/src/shared/lib/toast";

function MicrosoftMark() {
  return (
    <span className="grid grid-cols-2 gap-[3px] rounded-[0.35rem] bg-white p-[3px] shadow-sm">
      <span className="h-3 w-3 bg-[#f25022]" />
      <span className="h-3 w-3 bg-[#7fba00]" />
      <span className="h-3 w-3 bg-[#00a4ef]" />
      <span className="h-3 w-3 bg-[#ffb900]" />
    </span>
  );
}

export function SupabaseLoginButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);

  async function handleLogin() {
    if (disabled || pending) {
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account"
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error("Supabase no devolvio la URL de autenticacion.");
    } catch (error) {
      errorToast("No se pudo iniciar sesion", error instanceof Error ? error.message : "Configura Supabase Auth con Microsoft Entra para continuar.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLogin}
        disabled={disabled || pending}
        className="flex w-full items-center justify-center gap-4 rounded-[1.5rem] border border-[#bfd2e7] bg-white px-6 py-4 text-sm font-semibold text-[#001534] transition hover:border-[#9cb8d6] hover:bg-[#f5faff] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MicrosoftMark />
        <span>{pending ? "Redirigiendo a Microsoft..." : "Entrar con cuenta corporativa"}</span>
      </button>

      <div className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-slate-500">Supabase Auth + Microsoft Entra ID</div>
    </>
  );
}
