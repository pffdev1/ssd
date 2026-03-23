import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/auth";
import { BeneficiaryList } from "@/src/shared/components/BeneficiaryList";
import { PrintActions } from "@/src/shared/components/PrintActions";
import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { buildPayloadEntries, formatPayloadValue, getStepDigitalSignature, getSummaryEntityLabel } from "@/src/shared/lib/request-display";
import { getStatusLabel } from "@/src/shared/lib/status";
import { checkAdmin, getApproverProfile, getCatalog, getRequest, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

function formatDate(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return formatDateTimePanama(value);
}

export default async function RequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
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
  const request = await getRequest(id, currentUser.email);
  const requestTypeDefinition = catalog.requestTypes.find((type) => type.code === request.request_type_code);
  const beneficiaries = parseBeneficiaries(request.payload);
  const payloadEntries = buildPayloadEntries(request, requestTypeDefinition);
  const printedAt = formatDateTimePanama(new Date());
  const documentTitle = `Formato-${request.ticket_code}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[210mm] flex-col gap-4 bg-[#f3f7fc] px-4 py-4 print:min-h-0 print:bg-white print:px-0 print:py-0">
      <div className="print:hidden">
        <PrintActions documentTitle={documentTitle} />
      </div>

      <section className="print-sheet rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] print:rounded-none print:border-0 print:p-4 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-[#d7e4f2] pb-4 print:gap-3 print:pb-3">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e4f2] bg-white print:h-12 print:w-12">
              <Image src="/brand/pedersen-connect-logo.png" alt="Pedersen Connect" width={56} height={56} className="h-full w-full object-cover" priority />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#1f406b]">Pedersen Connect</div>
              <h1 className="mt-2 text-2xl font-semibold text-[#001534] print:mt-1 print:text-[1.35rem]">Formato imprimible de aprobacion</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1e3a5f] print:mt-1 print:text-[11px] print:leading-5">
                Documento de respaldo operativo con trazabilidad de aprobaciones y firmas digitales registradas en SSD.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[#bfd2e7] bg-[#f5faff] px-4 py-3 text-sm text-[#1e3a5f] print:px-3 print:py-2 print:text-[11px]">
            <div>
              <strong className="text-[#001534]">Ticket:</strong> {request.ticket_code}
            </div>
            <div className="mt-2">
              <strong className="text-[#001534]">Estado:</strong> {getStatusLabel(request.status)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 print:mt-3 print:gap-3 print:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Solicitante</div>
            <div className="mt-2 text-base font-semibold text-[#001534] print:text-sm">{request.requester_name}</div>
            <div className="mt-1 text-sm text-[#1e3a5f] print:text-[11px]">{request.requester_email}</div>
            <div className="mt-1 text-sm text-[#1e3a5f] print:text-[11px]">{request.department}</div>
          </div>

          <div className="rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{getSummaryEntityLabel(request.request_type_code)}</div>
            {beneficiaries.length > 0 ? (
              <div className="mt-2">
                <BeneficiaryList payload={request.payload} compact />
              </div>
            ) : (
              <div className="mt-2 text-base font-semibold text-[#001534]">{request.beneficiary_name ?? "N/A"}</div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:mt-3 print:p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Solicitud</div>
          <div className="mt-2 text-lg font-semibold text-[#001534] print:text-base">{request.subject}</div>
          <p className="mt-2 text-sm leading-6 text-[#1e3a5f] print:text-[11px] print:leading-5">{request.justification}</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] print:mt-3 print:gap-3 print:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Datos del formulario</div>
            <div className="mt-3 grid gap-3 print:mt-2 print:gap-2">
              {payloadEntries.map(({ key, label, value }) => (
                <div key={key} className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] p-3 print:p-2.5">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
                  {["beneficiarios", "beneficiario", "beneficiarioActivo", "colaborador"].includes(key) ? (
                    <div className="mt-1.5">
                      <BeneficiaryList payload={{ [key]: value }} compact />
                    </div>
                  ) : (
                    <div className="mt-1.5 text-sm leading-6 text-[#1e3a5f] print:text-[11px] print:leading-5">{formatPayloadValue(key, value)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Aprobaciones y firma digital</div>
            <div className="mt-3 space-y-3 print:mt-2 print:space-y-2">
              {request.steps.map((step) => {
                const signature = getStepDigitalSignature(step);

                return (
                  <div key={step.id} className="break-inside-avoid rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:p-3">
                    <div className="flex flex-wrap items-start justify-between gap-4 print:gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#001534] print:text-[12px]">{step.label}</div>
                        <div className="mt-1 text-sm text-[#1e3a5f] print:text-[11px]">{step.approver_name}</div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 print:text-[10px]">{step.approver_email}</div>
                      </div>
                      <div className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#1e3a5f] print:px-2.5 print:py-1 print:text-[10px]">
                        {getStatusLabel(step.status)}
                      </div>
                    </div>

                    {step.comments ? (
                      <div className="mt-3 rounded-2xl border border-[#d7e4f2] bg-white p-3 text-sm leading-6 text-[#1e3a5f] print:mt-2 print:p-2.5 print:text-[11px] print:leading-5">
                        {step.comments}
                      </div>
                    ) : null}

                    {signature ? (
                      <div className="mt-3 rounded-2xl border border-[#bfd2e7] bg-white p-3 print:mt-2 print:p-2.5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-[#0b5ed7]">Firma digital SSD</div>
                        <div className="mt-2 grid gap-2 print:mt-1.5">
                          <div className="text-sm text-[#1e3a5f] print:text-[11px]">
                            <strong className="text-[#001534]">Firmado por:</strong> {signature.signerName}
                          </div>
                          <div className="text-sm text-[#1e3a5f] print:text-[11px]">
                            <strong className="text-[#001534]">Fecha y hora:</strong> {formatDate(signature.signedAt)}
                          </div>
                          <div className="break-all font-mono text-[12px] leading-6 text-[#1e3a5f] print:text-[10px] print:leading-4">
                            <strong className="font-sans text-[#001534]">Hash:</strong> {signature.digest}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-[#bfd2e7] bg-white p-3 text-sm text-[#1e3a5f] print:mt-2 print:p-2.5 print:text-[11px]">
                        Firma pendiente. Este paso aun no ha sido ejecutado o aprobado.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="mt-4 border-t border-[#d7e4f2] pt-3 text-[11px] leading-5 text-[#46607d] print:mt-3 print:pt-2.5 print:text-[10px]">
          Pedersen Fine Foods | Departamento de Tecnologia e Innovacion | Fecha de impresion: {printedAt}
        </footer>
      </section>
    </main>
  );
}
