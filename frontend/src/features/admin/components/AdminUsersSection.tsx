"use client";

import { useState } from "react";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { runWithToast } from "@/src/shared/lib/toast";
import { AdminUser, AppUser } from "@/src/shared/lib/types";

function formatDate(value: string) {
  return formatDateTimePanama(value);
}

export function AdminUsersSection({
  currentUser,
  admins,
  onAdminsChange
}: {
  currentUser: AppUser;
  admins: AdminUser[];
  onAdminsChange: (admins: AdminUser[]) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/admins`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              fullName,
              email
            })
          });

          const payload = (await response.json()) as { message?: string; admins?: AdminUser[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo registrar el administrador");
          }

          return payload;
        })(),
        {
          loading: { title: "Agregando administrador..." },
          success: { title: "Administrador agregado" },
          error: { title: "No se pudo registrar" }
        }
      );

      onAdminsChange(data.admins ?? admins);
      setFullName("");
      setEmail("");
      setMessage("Administrador agregado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Acceso total</div>
        <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Administradores SSD</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
          Los administradores pueden modificar catalogos, matriz de aprobaciones y paneles operativos.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nombre completo"
            required
          />
          <input
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="correo@pffsa.com"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
          >
            {busy ? "Guardando..." : "Agregar administrador"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">Directorio</div>
            <h3 className="mt-2 text-xl font-semibold text-[#001534]">Administradores actuales</h3>
          </div>
          <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
            {admins.length} registro{admins.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="rounded-[1.3rem] border border-[#d7e4f2] bg-[#f9fbff] p-4">
              <div className="text-base font-semibold text-[#001534]">{admin.full_name}</div>
              <div className="mt-1 text-sm text-[#1e3a5f]">{admin.email}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatDate(admin.created_at)}</div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
