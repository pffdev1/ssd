import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PrintActions } from "@/src/shared/components/PrintActions";
import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { formatDateTimePanama, formatLongDatePanama } from "@/src/shared/lib/datetime";
import { getStepDigitalSignature } from "@/src/shared/lib/request-display";
import { checkAdmin, getApproverProfile, getRequest, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

function getBeneficiarySelection(values: string[], requested?: string) {
  if (!requested) {
    return values[0] ?? null;
  }

  const normalizedRequested = requested.trim().toLowerCase();
  return values.find((value) => value.trim().toLowerCase() === normalizedRequested) ?? values[0] ?? null;
}

export default async function MobileLineLetterPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ beneficiary?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [{ id }, resolvedSearch] = await Promise.all([params, searchParams]);
  const [adminCheck, approverProfiles, userRoles] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email)
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles);
  const request = await getRequest(id, currentUser.email);
  const beneficiaries = parseBeneficiaries(request.payload);
  const selectedBeneficiary = getBeneficiarySelection(beneficiaries, resolvedSearch.beneficiary);
  const ggStep = request.steps.find((step) => step.role_code === "GG_APPROVAL" && ["approved", "completed"].includes(step.status));
  const areaStep = request.steps.find((step) => step.role_code === "AREA_MANAGER" && ["approved", "completed"].includes(step.status));
  const deliveryStep = request.steps.find((step) => step.role_code === "IT_DELIVERY");
  const ggSignature = ggStep ? getStepDigitalSignature(ggStep) : null;
  const areaSignature = areaStep ? getStepDigitalSignature(areaStep) : null;
  const printedAt = formatDateTimePanama(new Date());
  const plan = String(request.payload.planSugerido ?? request.payload.planAutorizado ?? "Pendiente");
  const requiresDevice = String(request.payload.requiereEquipo ?? "Pendiente");

  if (request.request_type_code !== "MOBILE_LINE_REQUEST" || !selectedBeneficiary || !ggStep) {
    redirect(`/requests/${request.id}`);
  }

  const beneficiaryIndex = beneficiaries.findIndex((beneficiary) => beneficiary === selectedBeneficiary);
  const documentTitle = `Carta-Responsiva-${request.ticket_code}-${selectedBeneficiary}`;

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
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#1f406b]">Sistema de Solicitudes Digital</div>
              <h1 className="mt-2 text-2xl font-semibold text-[#001534] print:mt-1 print:text-[1.35rem]">Carta responsiva de linea celular corporativa</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1e3a5f] print:mt-1 print:text-[11px] print:leading-5">
                Documento operativo generado por SSD para la asignacion, entrega y aceptacion de linea celular y equipo asociado.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-[#bfd2e7] bg-[#f5faff] px-4 py-3 text-sm text-[#1e3a5f] print:px-3 print:py-2 print:text-[11px]">
            <div>
              <strong className="text-[#001534]">Ticket:</strong> {request.ticket_code}
            </div>
            <div className="mt-2">
              <strong className="text-[#001534]">Carta:</strong> {beneficiaryIndex + 1} de {beneficiaries.length}
            </div>
            <div className="mt-2">
              <strong className="text-[#001534]">Fecha de impresion:</strong> {printedAt}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 print:mt-3 print:gap-3 print:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Colaborador beneficiario</div>
            <div className="mt-2 text-lg font-semibold text-[#001534] print:text-base">{selectedBeneficiary}</div>
            <div className="mt-2 text-sm text-[#1e3a5f] print:text-[11px]">Departamento solicitante: {request.department}</div>
          </div>

          <div className="rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Solicitante</div>
            <div className="mt-2 text-base font-semibold text-[#001534] print:text-sm">{request.requester_name}</div>
            <div className="mt-1 text-sm text-[#1e3a5f] print:text-[11px]">{request.requester_email}</div>
            <div className="mt-1 text-sm text-[#1e3a5f] print:text-[11px]">{formatLongDatePanama(request.created_at)}</div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:mt-3 print:p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Servicio autorizado</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 print:grid-cols-2">
            <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3 print:p-2.5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Plan aprobado</div>
              <div className="mt-1.5 text-sm font-semibold text-[#001534] print:text-[11px]">{plan}</div>
            </div>
            <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3 print:p-2.5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Entrega fisica</div>
              <div className="mt-1.5 text-sm font-semibold text-[#001534] print:text-[11px]">{requiresDevice}</div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#1e3a5f] print:text-[11px] print:leading-5">
            El colaborador declara recibir y utilizar esta linea celular, SIM y/o equipo asociado exclusivamente para fines laborales, conforme a las politicas internas de Pedersen Fine Foods.
          </p>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:mt-3 print:p-3">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Autorizaciones registradas</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3 print:mt-2 print:gap-2 print:grid-cols-3">
            {areaStep ? (
              <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3 print:p-2.5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Gerencia de area</div>
                <div className="mt-1.5 text-sm font-semibold text-[#001534] print:text-[11px]">{areaStep.approver_name}</div>
                <div className="mt-1 break-all text-[12px] text-[#1e3a5f] print:text-[10px]">{areaSignature?.digest ?? "Sin hash registrado"}</div>
                <div className="mt-1 text-[12px] text-[#1e3a5f] print:text-[10px]">{areaSignature ? formatDateTimePanama(areaSignature.signedAt) : "Pendiente"}</div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3 print:p-2.5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Gerencia General</div>
              <div className="mt-1.5 text-sm font-semibold text-[#001534] print:text-[11px]">{ggStep.approver_name}</div>
              <div className="mt-1 break-all text-[12px] text-[#1e3a5f] print:text-[10px]">{ggSignature?.digest ?? "Sin hash registrado"}</div>
              <div className="mt-1 text-[12px] text-[#1e3a5f] print:text-[10px]">{ggSignature ? formatDateTimePanama(ggSignature.signedAt) : "Pendiente"}</div>
            </div>

            <div className="rounded-2xl border border-dashed border-[#bfd2e7] bg-white p-3 print:p-2.5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Entrega TI</div>
              <div className="mt-1.5 text-sm text-[#1e3a5f] print:text-[11px]">
                {deliveryStep?.status === "completed" ? "Entrega completada y registrada en SSD." : "Pendiente de gestion por Tecnologia e Innovacion."}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 print:mt-3 print:p-3">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Aceptacion del colaborador</div>
          <div className="mt-3 rounded-2xl border border-[#d7e4f2] bg-white p-4 print:p-3">
            <p className="text-sm leading-7 text-[#1e3a5f] print:text-[11px] print:leading-5">
              Yo, <strong className="text-[#001534]">{selectedBeneficiary}</strong>, acepto la asignacion de la linea celular corporativa asociada al ticket <strong className="text-[#001534]">{request.ticket_code}</strong> y me comprometo a utilizarla de forma responsable, reportar cualquier perdida o dano y devolver los activos cuando la empresa lo solicite.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2 print:mt-8 print:gap-4">
              <div>
                <div className="h-px bg-[#1e3a5f]" />
                <div className="mt-2 text-sm font-semibold text-[#001534] print:text-[11px]">{selectedBeneficiary}</div>
                <div className="text-[12px] text-[#1e3a5f] print:text-[10px]">Firma de recibido del colaborador</div>
              </div>
              <div>
                <div className="h-px bg-[#1e3a5f]" />
                <div className="mt-2 text-sm font-semibold text-[#001534] print:text-[11px]">Departamento de Tecnologia e Innovacion</div>
                <div className="text-[12px] text-[#1e3a5f] print:text-[10px]">Entrega y control del activo</div>
              </div>
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
