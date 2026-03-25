"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BeneficiaryList } from "@/src/shared/components/BeneficiaryList";
import { StatusBadge } from "@/src/shared/components/StatusBadge";
import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, PendingApprovalItem } from "@/src/shared/lib/types";

function formatDate(value: string) {
  return formatDateTimePanama(value);
}

export function ApproverInbox({ user, items }: { user: AppUser; items: PendingApprovalItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  async function takeAction(item: PendingApprovalItem, decision: "approve" | "reject" | "complete") {
    const comments = window.prompt("Comentarios para esta accion (opcional). Tu cuenta corporativa quedara registrada como firma digital:", "") ?? "";
    setBusyId(item.step_id);
    setMessages((current) => ({ ...current, [item.step_id]: "" }));

    try {
      const operation = (async () => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/requests/${item.id}/steps/${item.step_id}/decision`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              decision,
              comments,
              actorName: user.name,
              actorEmail: user.email
            })
          }
        );

        const data = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(data.message ?? "No se pudo procesar la solicitud");
        }

        return data;
      })();

      await runWithToast(operation, {
        loading: { title: "Procesando decision..." },
        success: { title: "Accion registrada" },
        error: { title: "No se pudo procesar" }
      });

      setMessages((current) => ({
        ...current,
        [item.step_id]: "Accion registrada correctamente."
      }));
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Error inesperado";
      setMessages((current) => ({
        ...current,
        [item.step_id]: nextMessage
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="text-xs uppercase tracking-[0.25em] text-[#1f406b]">Bandeja de aprobaciones</div>
        <h2 className="mt-4 text-2xl font-semibold text-[#001534]">Sin solicitudes pendientes</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#1e3a5f]">
          Cuando una solicitud te sea asignada por departamento o por rol corporativo, aparecera aqui.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:p-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-[#1f406b]">Bandeja de aprobaciones</div>
        <h2 className="mt-4 text-2xl font-semibold text-[#001534]">Solicitudes pendientes</h2>
      </div>

      <div className="space-y-5">
        {items.map((item) => {
          const beneficiaries = parseBeneficiaries(item.payload);
          const showPreviewCard = item.step_kind === "approval" && (item.step_label.includes("Gerencia") || item.step_label.includes("Área"));

          return (
            <article
              key={item.step_id}
              className="group relative overflow-hidden rounded-[1.8rem] border border-[#d7e4f2] bg-[linear-gradient(180deg,#f9fbff_0%,#eef5ff_100%)] p-5 transition hover:border-[#3490ff] hover:shadow-[0_18px_50px_rgba(17,85,204,0.16)]"
            >
              {showPreviewCard ? (
                <div className="pointer-events-none absolute right-5 top-5 hidden w-[19rem] translate-y-2 rounded-[1.5rem] border border-[#b7d2ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(236,245,255,0.98)_100%)] p-4 opacity-0 shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 xl:block">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f0ff] text-[#0b5ed7]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path d="m5 12 4 4 10-10" />
                      </svg>
                    </span>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-[#0b5ed7]">Booking Confirmed</div>
                      <div className="mt-1 text-sm font-semibold text-[#001534]">Lista para revision</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[#1e3a5f]">
                    <div>Solicitante: {item.requester_name}</div>
                    <div>Ticket: {item.ticket_code}</div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Beneficiarios</div>
                    <BeneficiaryList payload={item.payload} compact fallback="Sin beneficiarios" />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.ticket_code}</div>
                  <h3 className="mt-2 text-xl font-semibold text-[#001534]">{item.subject}</h3>
                  <div className="mt-3 text-sm text-[#1e3a5f]">
                    {item.request_type_name} | {item.requester_name} | {item.department}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#bfd2e7] bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paso</div>
                  <div className="mt-2 text-sm font-semibold text-[#001534]">{item.step_label}</div>
                </div>
                <div className="rounded-2xl border border-[#bfd2e7] bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Solicitante</div>
                  <div className="mt-2 text-sm font-semibold text-[#001534]">{item.requester_email}</div>
                </div>
                <div className="rounded-2xl border border-[#bfd2e7] bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Recibida</div>
                  <div className="mt-2 text-sm font-semibold text-[#001534]">{formatDate(item.created_at)}</div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-[#1e3a5f]">{item.justification}</p>

              {beneficiaries.length > 0 ? (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Beneficiarios</div>
                  <BeneficiaryList payload={item.payload} compact />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/requests/${item.id}`}
                  className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-medium text-[#1e3a5f] transition hover:bg-[#f5faff]"
                >
                  Ver detalle
                </Link>
                <Link
                  href={`/requests/${item.id}/print`}
                  className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-medium text-[#1e3a5f] transition hover:bg-[#f5faff]"
                >
                  Formato imprimible
                </Link>

                {item.step_kind === "approval" ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === item.step_id}
                      onClick={() => takeAction(item, "approve")}
                      className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
                    >
                      Aprobar y firmar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.step_id}
                      onClick={() => takeAction(item, "reject")}
                      className="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      Rechazar y firmar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === item.step_id}
                    onClick={() => takeAction(item, "complete")}
                    className="rounded-full bg-[#1f406b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#001534] disabled:opacity-60"
                  >
                    Completar y firmar
                  </button>
                )}
              </div>

              {messages[item.step_id] ? <p className="mt-4 text-sm text-slate-600">{messages[item.step_id]}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
