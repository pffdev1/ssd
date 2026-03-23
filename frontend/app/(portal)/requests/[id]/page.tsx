import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { BeneficiaryList } from "@/src/shared/components/BeneficiaryList";
import { StatusBadge } from "@/src/shared/components/StatusBadge";
import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { buildPayloadEntries, formatPayloadValue, getStepDigitalSignature, getSummaryEntityLabel } from "@/src/shared/lib/request-display";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getRequest, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

function formatDate(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return formatDateTimePanama(value);
}

function getStepTone(status: string) {
  switch (status) {
    case "approved":
    case "completed":
      return {
        line: "bg-[#82b3ff]",
        dot: "border-[#0b5ed7] bg-[#0b5ed7] text-white",
        card: "border-[#c8daf4] bg-[#f8fbff]",
        label: "Completado"
      };
    case "rejected":
      return {
        line: "bg-rose-200",
        dot: "border-rose-500 bg-rose-500 text-white",
        card: "border-rose-200 bg-rose-50/70",
        label: "Rechazado"
      };
    case "pending":
      return {
        line: "bg-[#0b5ed7]",
        dot: "border-[#0b5ed7] bg-white text-[#0b5ed7]",
        card: "border-[#8ebdff] bg-[#eef5ff] shadow-[0_14px_34px_rgba(11,94,215,0.12)]",
        label: "Paso actual"
      };
    default:
      return {
        line: "bg-[#d7e4f2]",
        dot: "border-[#b7cce6] bg-white text-[#9ab2cc]",
        card: "border-[#d7e4f2] bg-[#f8fbff]",
        label: "Pendiente"
      };
  }
}

function hasApprovedGeneralManagement(request: Awaited<ReturnType<typeof getRequest>>) {
  return request.steps.some((step) => step.role_code === "GG_APPROVAL" && ["approved", "completed"].includes(step.status));
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const { id } = await params;
  const [adminCheck, approverProfiles, userRoles, catalog] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog()
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles);
  const [request, inboxItems] = await Promise.all([getRequest(id, currentUser.email), getApproverInbox(currentUser.email)]);
  const requestTypeDefinition = catalog.requestTypes.find((type) => type.code === request.request_type_code);
  const visibleTypes = catalog.requestTypes.filter(
    (type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows
  );
  const beneficiaries = parseBeneficiaries(request.payload);
  const payloadEntries = buildPayloadEntries(request, requestTypeDefinition);
  const canShowResponsivas = request.request_type_code === "MOBILE_LINE_REQUEST" && hasApprovedGeneralManagement(request) && beneficiaries.length > 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin={currentUser.isAdmin}
        requestTypes={visibleTypes}
        title="SSD | Detalle de solicitud"
        subtitle="Consulta el historial, los pasos del flujo y la trazabilidad completa de la solicitud."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/catalogo" className="text-sm uppercase tracking-[0.24em] text-[#1f406b]">
            Volver al catalogo
          </Link>
          <h1 className="mt-4 text-4xl font-semibold text-[#001534]">{request.subject}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#1e3a5f]">
            {request.request_type_name} | {request.department} | {request.requester_name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/requests/${request.id}/print`}
            className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-medium text-[#1e3a5f] transition hover:bg-[#f5faff]"
          >
            Descargar formato impreso
          </Link>
          <StatusBadge status={request.status} />
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ticket</div>
              <div className="mt-2 text-lg font-semibold text-[#001534]">{request.ticket_code}</div>
            </div>
            <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{getSummaryEntityLabel(request.request_type_code)}</div>
              {beneficiaries.length > 0 ? (
                <BeneficiaryList payload={request.payload} compact />
              ) : (
                <div className="mt-2 text-lg font-semibold text-[#001534]">{request.beneficiary_name ?? "N/A"}</div>
              )}
            </div>
            <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Justificacion</div>
              <div className="mt-2 text-sm leading-7 text-[#1e3a5f]">{request.justification}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Datos del formulario</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {payloadEntries.map(({ key, label, value }) => (
                <div key={key} className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                  {["beneficiarios", "beneficiario", "beneficiarioActivo", "colaborador"].includes(key) ? (
                    <BeneficiaryList payload={{ [key]: value }} />
                  ) : (
                    <div className="mt-2 text-sm leading-7 text-[#1e3a5f]">{formatPayloadValue(key, value)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {request.request_type_code === "MOBILE_LINE_REQUEST" ? (
            <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Cartas responsivas</div>
                  <div className="mt-2 text-lg font-semibold text-[#001534]">Entrega documental por beneficiario</div>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#1e3a5f]">
                    {canShowResponsivas
                      ? "La solicitud ya cuenta con aprobacion de Gerencia General. Aqui puedes abrir la carta responsiva individual de cada beneficiario."
                      : "La carta responsiva se habilitara cuando la solicitud reciba la aprobacion final de Gerencia General."}
                  </p>
                </div>
              </div>

              {canShowResponsivas ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {beneficiaries.map((beneficiary, index) => (
                    <div key={`${request.id}-${beneficiary}-${index}`} className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Carta responsiva #{index + 1}</div>
                      <div className="mt-2 text-base font-semibold text-[#001534]">{beneficiary}</div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/requests/${request.id}/responsiva?beneficiary=${encodeURIComponent(beneficiary)}`}
                          className="rounded-full bg-[#0b5ed7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0847a8]"
                        >
                          Abrir carta responsiva
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Flujo</div>
            <div className="mt-5 space-y-0">
              {request.steps.map((step, index) => {
                const tone = getStepTone(step.status);
                const isCurrent = step.status === "pending";
                const isDone = step.status === "approved" || step.status === "completed";
                const isRejected = step.status === "rejected";
                const signature = getStepDigitalSignature(step);

                return (
                  <div key={step.id} className="relative pl-10">
                    {index < request.steps.length - 1 ? (
                      <div className={`absolute left-[0.875rem] top-9 h-[calc(100%-0.25rem)] w-px ${isDone ? "bg-[#82b3ff]" : tone.line}`} />
                    ) : null}

                    <div
                      className={`absolute left-0 top-6 flex h-7 w-7 items-center justify-center rounded-full border-2 ${tone.dot} ${
                        isCurrent ? "animate-pulse shadow-[0_0_0_8px_rgba(11,94,215,0.12)]" : ""
                      }`}
                    >
                      {isDone ? (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
                          <path d="m4 10 4 4 8-8" />
                        </svg>
                      ) : isRejected ? (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
                          <path d="m6 6 8 8" />
                          <path d="m14 6-8 8" />
                        </svg>
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-current" />
                      )}
                    </div>

                    <div className={`mb-4 rounded-[1.6rem] border p-4 ${tone.card}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold text-[#001534]">{step.label}</div>
                          <div className="mt-2 text-sm text-[#1e3a5f]">{step.approver_name}</div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            {step.kind === "approval" ? "Aprobacion" : "Ejecucion"} | {step.approver_email}
                          </div>
                        </div>

                        <div className="rounded-full border border-[#c8daf4] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b5ed7]">
                          {tone.label}
                        </div>
                      </div>

                      {step.comments ? (
                        <div className="mt-4 rounded-2xl border border-[#bfd2e7] bg-white p-3 text-sm leading-7 text-[#1e3a5f]">
                          {step.comments}
                        </div>
                      ) : null}

                      {signature ? (
                        <div className="mt-4 rounded-2xl border border-[#bfd2e7] bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#0b5ed7]">Firma digital SSD</div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="text-sm text-[#1e3a5f]">
                              <strong className="text-[#001534]">Firmado por:</strong> {signature.signerName}
                            </div>
                            <div className="text-sm text-[#1e3a5f]">
                              <strong className="text-[#001534]">Correo:</strong> {signature.signerEmail}
                            </div>
                            <div className="text-sm text-[#1e3a5f]">
                              <strong className="text-[#001534]">Fecha y hora:</strong> {formatDate(signature.signedAt)}
                            </div>
                            <div className="break-all font-mono text-[12px] leading-6 text-[#1e3a5f]">
                              <strong className="font-sans text-[#001534]">Hash:</strong> {signature.digest}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                        Actualizado: {formatDate(step.acted_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Auditoria</div>
            <div className="mt-5 space-y-4">
              {request.events.map((event) => (
                <div key={event.id} className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f5faff] p-4">
                  <div className="text-sm font-semibold text-[#001534]">{event.notes}</div>
                  <div className="mt-2 text-sm text-[#1e3a5f]">
                    {event.actor_name} | {event.actor_email}
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                    {formatDate(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
