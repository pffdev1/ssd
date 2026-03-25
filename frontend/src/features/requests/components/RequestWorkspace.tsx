"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/src/shared/components/StatusBadge";
import { stringifyBeneficiaries } from "@/src/shared/lib/beneficiaries";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, CatalogResponse, FormFieldDefinition, RequestItem, RequestType } from "@/src/shared/lib/types";

function formatDate(value: string) {
  return formatDateTimePanama(value);
}

function inferBeneficiary(payload: Record<string, string>) {
  return stringifyBeneficiaries(payload);
}

function isRestrictedType(typeCode: string) {
  return typeCode === "PERSONNEL_REQUEST" || typeCode === "TERMINATION_REQUEST";
}

function parseDateParts(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function calculateInclusiveDays(startDate: string, endDate: string) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  if (!start || !end) {
    return null;
  }

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  if (endUtc < startUtc) {
    return null;
  }

  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

function buildInitialFormValues(selectedType: RequestType | undefined, requesterName: string): Record<string, string> {
  if (!selectedType) {
    return {};
  }

  if (selectedType.code === "VACATION_REQUEST") {
    return {
      colaborador: requesterName
    };
  }

  return {};
}

function getVisibleRequestTypes(requestTypes: RequestType[], currentUser: AppUser) {
  return requestTypes.filter((type) => {
    if (!isRestrictedType(type.code)) {
      return true;
    }

    return Boolean(currentUser.canManagePeopleFlows || currentUser.isAdmin);
  });
}

function DynamicField({
  field,
  value,
  onChange
}: {
  field: FormFieldDefinition;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const sharedClasses =
    "w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition placeholder:text-slate-400 focus:border-[#1f406b]";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${sharedClasses} min-h-28 resize-y`}
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }

  if (field.type === "dropdown") {
    return (
      <select
        className={sharedClasses}
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        required={field.required}
      >
        <option value="">Seleccione una opcion</option>
        {field.options?.map((option) => (
          <option key={option.option} value={option.option}>
            {option.option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="grid gap-3">
        {field.options?.map((option) => (
          <label
            key={option.option}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
              value === option.option
                ? "border-[#1f406b] bg-[#eaf6ff] text-[#001534]"
                : "border-[#bfd2e7] bg-white text-[#1e3a5f] hover:bg-[#f5faff]"
            }`}
          >
            <input
              type="radio"
              name={field.name}
              value={option.option}
              checked={value === option.option}
              onChange={(event) => onChange(field.name, event.target.value)}
              className="h-4 w-4 accent-[#1e3a5f]"
            />
            {option.option}
          </label>
        ))}
      </div>
    );
  }

  const type = field.type === "number" ? "number" : field.type;

  return (
    <input
      className={sharedClasses}
      type={type}
      value={value}
      onChange={(event) => onChange(field.name, event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

export function RequestWorkspace({
  catalog,
  requests,
  currentUser,
  initialTypeCode
}: {
  catalog: CatalogResponse;
  requests: RequestItem[];
  currentUser: AppUser;
  initialTypeCode?: string;
}) {
  const visibleRequestTypes = useMemo(() => getVisibleRequestTypes(catalog.requestTypes, currentUser), [catalog.requestTypes, currentUser]);
  const singleTypeView = visibleRequestTypes.length === 1;
  const [selectedTypeCode, setSelectedTypeCode] = useState(initialTypeCode || visibleRequestTypes[0]?.code || "");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState("");
  const [subject, setSubject] = useState(visibleRequestTypes[0]?.name ?? "");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedType =
    visibleRequestTypes.find((type) => type.code === selectedTypeCode) ?? visibleRequestTypes[0] ?? catalog.requestTypes[0];
  const departmentStepAssignments = useMemo(() => {
    if (!selectedType || !department) {
      return [];
    }

    return selectedType.workflow.steps
      .filter((step) => step.routing === "department" || step.routing === "requester_unit")
      .map((step) => {
        const approver = catalog.approvers.find((item) => item.department === department && item.role_code === step.code);
        const graphManagerPreview =
          step.routing === "requester_unit" && currentUser.managerEmail
            ? {
                full_name: currentUser.managerName ?? "Jefatura inmediata",
                email: currentUser.managerEmail,
                title: currentUser.managerTitle ?? "Jefatura inmediata"
              }
            : null;
        const resolvedApprover = approver
          ? {
              full_name: approver.full_name,
              email: approver.email,
              title: approver.title
            }
          : graphManagerPreview;
        const isSelf = resolvedApprover ? resolvedApprover.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase() : false;
        const stepIndex = selectedType.workflow.steps.findIndex((item) => item.code === step.code);
        const nextStep = isSelf
          ? selectedType.workflow.steps.slice(stepIndex + 1).find((candidate) => {
              if (candidate.routing === "scope") {
                return true;
              }

              const candidateApprover = catalog.approvers.find(
                (item) => item.department === department && item.role_code === candidate.code
              );

              if (!candidateApprover) {
                return true;
              }

              return candidateApprover.email.trim().toLowerCase() !== currentUser.email.trim().toLowerCase();
            }) ?? null
          : null;
        const nextApprover =
          nextStep && (nextStep.routing === "department" || nextStep.routing === "requester_unit")
            ? catalog.approvers.find((item) => item.department === department && item.role_code === nextStep.code)
            : undefined;

        return {
          step,
          approver: resolvedApprover,
          isSelf,
          nextStep,
          nextApprover
        };
      });
  }, [catalog.approvers, currentUser.email, department, selectedType]);
  const vacationDays = useMemo(() => {
    if (selectedType?.code !== "VACATION_REQUEST") {
      return null;
    }

    return calculateInclusiveDays(formValues.fechaInicio ?? "", formValues.fechaFin ?? "");
  }, [formValues.fechaFin, formValues.fechaInicio, selectedType?.code]);

  const resolvedFields = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    const nextFields = selectedType.fields
      .filter((field) => {
        if (selectedType.code !== "VACATION_REQUEST") {
          return true;
        }

        return !["diasSolicitados", "diasTomados", "planCobertura"].includes(field.name);
      })
      .map((field) => {
        if (selectedType.code === "MOBILE_LINE_REQUEST" && field.name === "beneficiario") {
          return {
            ...field,
            label: "Beneficiario(s) de la linea",
            type: "textarea" as const,
            placeholder: "Escribe uno o varios beneficiarios. Puedes separarlos por linea, coma o punto y coma."
          };
        }

        return field;
      });

    if (selectedType.code !== "VACATION_REQUEST") {
      return nextFields;
    }

    const collaboratorField = nextFields.find((field) => field.name === "colaborador") ?? {
      name: "colaborador",
      label: "Colaborador",
      type: "text" as const,
      required: true,
      placeholder: "Nombre del colaborador que tomara la ausencia"
    };
    const otherFields = nextFields.filter((field) => field.name !== "colaborador");

    return [collaboratorField, ...otherFields];
  }, [selectedType]);

  useEffect(() => {
    if (!selectedType) {
      return;
    }

    setFormValues(buildInitialFormValues(selectedType, currentUser.name));
    setSubject(selectedType.name);
    setDepartment("");
    setMessage(null);
  }, [currentUser.name, selectedType]);

  useEffect(() => {
    if (initialTypeCode && visibleRequestTypes.some((type) => type.code === initialTypeCode)) {
      setSelectedTypeCode(initialTypeCode);
    }
  }, [initialTypeCode, visibleRequestTypes]);

  const groupedTypes = useMemo(() => {
    return visibleRequestTypes.reduce<Record<string, RequestType[]>>((accumulator, type) => {
      if (!accumulator[type.category]) {
        accumulator[type.category] = [];
      }
      accumulator[type.category].push(type);
      return accumulator;
    }, {});
  }, [visibleRequestTypes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const operation = (async () => {
        const normalizedPayload = {
          ...formValues
        };

        if (selectedType.code === "VACATION_REQUEST") {
          if (vacationDays === null) {
            throw new Error("Completa una fecha de inicio y fin valida para calcular los dias tomados");
          }

          delete normalizedPayload.diasSolicitados;
          delete normalizedPayload.planCobertura;
          normalizedPayload.diasTomados = String(vacationDays);
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            requestTypeCode: selectedType.code,
            requesterName: currentUser.name,
            requesterEmail: currentUser.email,
            requesterManagerName: currentUser.managerName,
            requesterManagerEmail: currentUser.managerEmail,
            requesterManagerTitle: currentUser.managerTitle,
            department,
            subject,
            justification,
            beneficiaryName: inferBeneficiary(formValues),
            payload: normalizedPayload
          })
        });

        const data = (await response.json()) as { ticketCode?: string; message?: string };

        if (!response.ok) {
          throw new Error(data.message ?? "No se pudo registrar la solicitud");
        }

        return data;
      })();

      const data = await runWithToast(operation, {
        loading: { title: "Creando solicitud..." },
        success: { title: "Solicitud registrada" },
        error: { title: "No se pudo crear la solicitud" }
      });

      setMessage(`Solicitud creada con exito. Ticket asignado: ${data.ticketCode}`);
      setFormValues({});
      setDepartment("");
      setJustification("");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Ocurrio un error inesperado";
      setMessage(nextMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`grid gap-6 ${singleTypeView ? "xl:grid-cols-[1.2fr_0.8fr]" : "xl:grid-cols-[0.95fr_1.2fr_0.85fr]"}`}>
      {!singleTypeView ? (
        <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Catalogo de solicitudes</div>
            <h2 className="mt-3 text-2xl font-semibold text-[#001534]">Solicitudes disponibles</h2>
            <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
              Selecciona un flujo y SSD te mostrara el formulario y la ruta de aprobacion correspondiente.
            </p>
          </div>

          <div className="space-y-5">
            {Object.entries(groupedTypes).map(([category, items]) => (
              <div key={category}>
                <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">{category}</div>
                <div className="space-y-3">
                  {items.map((type) => {
                    const active = selectedType.code === type.code;

                    return (
                      <button
                        type="button"
                        key={type.code}
                        onClick={() => setSelectedTypeCode(type.code)}
                        className={`w-full rounded-[1.6rem] border p-4 text-left transition ${
                          active
                            ? "border-[#9cb8d6] bg-[#eaf6ff] shadow-sm"
                            : "border-[#d7e4f2] bg-[#f5faff] hover:bg-[#eaf6ff]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-base font-semibold text-[#001534]">{type.name}</div>
                            <p className="mt-2 text-sm leading-7 text-[#1e3a5f]">{type.description}</p>
                          </div>
                          <div className="h-12 w-1 rounded-full" style={{ backgroundColor: type.theme_color }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[#1f406b]">Nueva solicitud</div>
            <h2 className="mt-3 text-2xl font-semibold text-[#001534]">{selectedType.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#1e3a5f]">{selectedType.description}</p>
          </div>
          {selectedType.requires_general_management ? (
            <div className="rounded-full border border-[#9cb8d6] bg-[#eaf6ff] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#1e3a5f]">
              Incluye aprobacion GG
            </div>
          ) : null}
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1e3a5f]">Solicitante</label>
              <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] px-4 py-3 text-sm text-[#001534]">
                {currentUser.name}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1e3a5f]">Correo corporativo</label>
              <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] px-4 py-3 text-sm text-[#001534]">
                {currentUser.email}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-[#1e3a5f]">Jefatura inmediata (Microsoft Entra)</label>
              <div className="rounded-2xl border border-[#d7e4f2] bg-[#f5faff] px-4 py-3 text-sm text-[#001534]">
                {currentUser.managerName || currentUser.managerEmail
                  ? `${currentUser.managerName ?? "Supervisor"}${currentUser.managerEmail ? ` | ${currentUser.managerEmail}` : ""}`
                  : "No disponible en Entra. SSD aplicara el fallback por departamento/organigrama."}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1e3a5f]">Departamento</label>
              <select
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#1f406b]"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                required
              >
                <option value="">Seleccione un departamento</option>
                {catalog.departments.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1e3a5f]">Asunto</label>
              <input
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#1f406b]"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Asunto ejecutivo de la solicitud"
                required
              />
            </div>
          </div>

          {department ? (
            <div className="rounded-[1.6rem] border border-[#d7e4f2] bg-[#f5faff] p-5">
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Ruta inicial del departamento</div>
              <div className="mt-4 grid gap-3">
                {departmentStepAssignments.length > 0 ? (
                  departmentStepAssignments.map(({ step, approver, isSelf, nextStep, nextApprover }) => (
                    <div key={step.code} className="rounded-2xl border border-[#bfd2e7] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#001534]">{step.label}</div>
                          {approver ? (
                            isSelf ? (
                              <div className="mt-2 text-sm text-amber-700">
                                Este paso se omitira porque eres el solicitante.
                                {nextStep
                                  ? ` SSD continuara con ${nextStep.label}${nextApprover ? `: ${nextApprover.full_name}` : ""}.`
                                  : " SSD continuara con el siguiente paso disponible."}
                              </div>
                            ) : (
                              <>
                                <div className="mt-2 text-base font-semibold text-[#1e3a5f]">{approver.full_name}</div>
                                <div className="mt-1 text-sm text-slate-600">{approver.title}</div>
                                <div className="mt-1 text-sm text-slate-600">{approver.email}</div>
                              </>
                            )
                          ) : (
                            <div className="mt-2 text-sm text-amber-700">
                              No hay responsable configurado para {department} en este paso.
                            </div>
                          )}
                        </div>
                        <span className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#1e3a5f]">
                          {isSelf ? "Autoomitido" : step.routing === "requester_unit" ? "Supervisor" : approver ? "Principal" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#bfd2e7] bg-white p-4 text-sm leading-7 text-[#1e3a5f]">
                    Este tipo de solicitud no usa una aprobacion inicial por departamento.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1e3a5f]">Justificacion general</label>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#1f406b]"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Explica el impacto operativo, urgencia y beneficio para el negocio"
              required
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {resolvedFields.map((field) => (
              <div key={field.name} className={field.type === "textarea" || field.type === "radio" ? "md:col-span-2" : ""}>
                <label className="mb-2 block text-sm font-medium text-[#1e3a5f]">{field.label}</label>
                <DynamicField
                  field={field}
                  value={formValues[field.name] ?? ""}
                  onChange={(name, value) =>
                    setFormValues((current) => ({
                      ...current,
                      [name]: value
                    }))
                  }
                />
              </div>
            ))}

            {selectedType.code === "VACATION_REQUEST" ? (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[#1e3a5f]">Dias tomados</label>
                <div className="rounded-[1.6rem] border border-[#bfd2e7] bg-[#f5faff] px-4 py-4 text-sm text-[#001534]">
                  {vacationDays === null
                    ? "Completa la fecha de inicio y fin para calcular automaticamente los dias."
                    : `${vacationDays} dia${vacationDays === 1 ? "" : "s"}`}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.6rem] border border-[#d7e4f2] bg-[#f5faff] p-5">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Ruta de aprobacion</div>
            <div className="mt-4 grid gap-3">
              {selectedType.workflow.steps.map((step, index) => (
                <div key={step.code} className="flex items-center gap-4 rounded-2xl border border-[#bfd2e7] bg-white p-4">
                  {(() => {
                    const preview = departmentStepAssignments.find((item) => item.step.code === step.code);

                    return (
                      <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf6ff] text-sm font-semibold text-[#1e3a5f]">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#001534]">{step.label}</div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      {step.kind === "approval" ? "Aprobacion" : "Ejecucion"} |{" "}
                      {step.routing === "department"
                        ? "Por departamento"
                        : step.routing === "requester_unit"
                          ? "Supervisor del departamento"
                          : step.scope}
                    </div>
                    {(step.routing === "department" || step.routing === "requester_unit") && department ? (
                      <div className="mt-2 text-sm text-[#1e3a5f]">
                        {preview?.isSelf
                          ? `Autoomitido por autoaprobacion${
                              preview.nextStep ? `. Continua con ${preview.nextStep.label}` : ""
                            }`
                          : preview?.approver
                          ? `Responsable: ${preview.approver.full_name}`
                          : "Responsable pendiente por configurar"}
                      </div>
                    ) : null}
                    {step.routing === "requester_unit" ? (
                      <div className="mt-2 text-sm text-[#1e3a5f]">
                        {preview?.isSelf
                          ? "Como eres el responsable de este paso, SSD lo omitira automaticamente y seguira con la siguiente aprobacion."
                          : "SSD tomara este paso desde el supervisor principal configurado para el departamento seleccionado."}
                      </div>
                    ) : null}
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#1e3a5f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1f406b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Registrando..." : "Crear solicitud"}
            </button>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </div>
        </form>
      </section>

      <section className="space-y-6">
        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Perfil de acceso</div>
          <h2 className="mt-3 text-xl font-semibold text-[#001534]">Tu visibilidad actual</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {(currentUser.roleLabels ?? ["Colaborador"]).map((role) => (
              <span key={role} className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-sm text-[#1e3a5f]">
                {role}
              </span>
            ))}
          </div>
          {!currentUser.canManagePeopleFlows ? (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Los flujos de solicitud de personal y desvinculacion solo se muestran a jefes, gerentes, RRHH o administradores.
            </p>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Solicitudes recientes</div>
          <div className="mt-5 space-y-4">
            {requests.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className="block rounded-[1.4rem] border border-[#d7e4f2] bg-[#f5faff] p-4 transition hover:bg-[#eaf6ff]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-500">{item.ticket_code}</div>
                    <div className="mt-1 text-base font-semibold text-[#001534]">{item.subject}</div>
                    <div className="mt-2 text-sm text-[#1e3a5f]">{item.requester_name}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                  {item.department} | {formatDate(item.created_at)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
