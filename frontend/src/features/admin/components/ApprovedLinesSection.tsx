"use client";

import Link from "next/link";
import { BeneficiaryList } from "@/src/shared/components/BeneficiaryList";
import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { RequestItem } from "@/src/shared/lib/types";

export function ApprovedLinesSection({ items }: { items: RequestItem[] }) {
  return (
    <section className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Operacion TI</div>
          <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Lineas celulares aprobadas por GG</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#1e3a5f]">
            Este espacio consolida las solicitudes aprobadas por Gerencia General para que TI gestione entrega y cartas responsivas por beneficiario.
          </p>
        </div>
        <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
          {items.length} solicitud{items.length === 1 ? "" : "es"}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm leading-7 text-[#1e3a5f]">
            Aun no hay solicitudes de linea con aprobacion final de Gerencia General.
          </div>
        ) : null}

        {items.map((request) => {
          const beneficiaries = parseBeneficiaries(request.payload);

          return (
            <article key={request.id} className="rounded-[1.6rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{request.ticket_code}</div>
                  <div className="mt-2 text-xl font-semibold text-[#001534]">{request.subject}</div>
                  <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
                    {request.requester_name} | {request.department} | {beneficiaries.length} carta
                    {beneficiaries.length === 1 ? "" : "s"} responsiva{beneficiaries.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="rounded-full border border-[#8ebdff] bg-[#eef5ff] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#0b5ed7]">
                  GG aprobada
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Beneficiarios</div>
                <div className="mt-3">
                  <BeneficiaryList payload={request.payload} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {beneficiaries.map((beneficiary, index) => (
                  <div key={`${request.id}-${beneficiary}-${index}`} className="rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Carta responsiva #{index + 1}</div>
                    <div className="mt-3 text-base font-semibold text-[#001534]">{beneficiary}</div>
                    <div className="mt-3 text-sm leading-7 text-[#1e3a5f]">
                      <div>Solicitante: {request.requester_name}</div>
                      <div>Correo: {request.requester_email}</div>
                      <div>Departamento: {request.department}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/requests/${request.id}/responsiva?beneficiary=${encodeURIComponent(beneficiary)}`}
                        className="rounded-full bg-[#0b5ed7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0847a8]"
                      >
                        Abrir carta responsiva
                      </Link>
                      <Link
                        href={`/requests/${request.id}`}
                        className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#f5faff]"
                      >
                        Ver solicitud
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
