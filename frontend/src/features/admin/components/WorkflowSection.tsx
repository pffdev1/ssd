"use client";

import { useEffect, useMemo, useState } from "react";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, RequestType, WorkflowStepTemplate } from "@/src/shared/lib/types";

function StepBadge({
  kind,
  routing,
  scope
}: {
  kind: "approval" | "fulfillment";
  routing: "department" | "scope" | "requester_unit";
  scope?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
        {kind === "approval" ? "Aprobacion" : "Ejecucion"}
      </span>
      <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
        {routing === "department" ? "Por departamento" : routing === "requester_unit" ? "Supervisor del departamento" : scope ?? "Scope"}
      </span>
    </div>
  );
}

export function WorkflowSection({
  currentUser,
  requestTypes,
  stepTemplates,
  onRequestTypesChange
}: {
  currentUser: AppUser;
  requestTypes: RequestType[];
  stepTemplates: WorkflowStepTemplate[];
  onRequestTypesChange: (requestTypes: RequestType[]) => void;
}) {
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState(requestTypes[0]?.id ?? "");
  const [draftStepCodes, setDraftStepCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!requestTypes.length) {
      return;
    }

    if (!requestTypes.some((item) => item.id === selectedRequestTypeId)) {
      setSelectedRequestTypeId(requestTypes[0].id);
    }
  }, [requestTypes, selectedRequestTypeId]);

  const selectedRequestType = requestTypes.find((item) => item.id === selectedRequestTypeId) ?? requestTypes[0] ?? null;

  useEffect(() => {
    if (!selectedRequestType) {
      setDraftStepCodes([]);
      return;
    }

    setDraftStepCodes(selectedRequestType.workflow.steps.map((step) => step.code));
    setMessage(null);
  }, [selectedRequestType?.id]);

  const activeStepTemplates = useMemo(
    () =>
      draftStepCodes
        .map((code) => stepTemplates.find((step) => step.code === code))
        .filter(Boolean) as WorkflowStepTemplate[],
    [draftStepCodes, stepTemplates]
  );

  const availableStepTemplates = useMemo(
    () => stepTemplates.filter((step) => step.active && !draftStepCodes.includes(step.code)),
    [draftStepCodes, stepTemplates]
  );

  function moveStep(index: number, direction: "up" | "down") {
    setDraftStepCodes((current) => {
      const next = [...current];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function addStep(code: string) {
    setDraftStepCodes((current) => [...current, code]);
  }

  function removeStep(code: string) {
    setDraftStepCodes((current) => current.filter((item) => item !== code));
  }

  const hasChanges =
    selectedRequestType !== null &&
    JSON.stringify(draftStepCodes) !== JSON.stringify(selectedRequestType.workflow.steps.map((step) => step.code));

  async function saveWorkflow() {
    if (!selectedRequestType) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/admin/request-types/${selectedRequestType.id}/workflow`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                actorEmail: currentUser.email,
                stepCodes: draftStepCodes
              })
            }
          );

          const payload = (await response.json()) as { message?: string; requestTypes?: RequestType[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo actualizar el workflow");
          }

          return payload;
        })(),
        {
          loading: { title: "Guardando workflow..." },
          success: { title: "Workflow actualizado" },
          error: { title: "No se pudo actualizar el workflow" }
        }
      );

      onRequestTypesChange(data.requestTypes ?? requestTypes);
      setMessage("Workflow actualizado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Tipos de solicitud</div>
        <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Editor de workflows</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
          Aqui defines el orden real del flujo: que revisa el area, cuando entra Finanzas, cuando sube a GG y quien ejecuta la parte final.
        </p>

        <div className="mt-6 space-y-3">
          {requestTypes.map((requestType) => {
            const active = requestType.id === selectedRequestType?.id;

            return (
              <button
                key={requestType.id}
                type="button"
                onClick={() => setSelectedRequestTypeId(requestType.id)}
                className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                  active
                    ? "border-[#8ebdff] bg-[#eef5ff] shadow-[0_12px_28px_rgba(11,94,215,0.08)]"
                    : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#001534]">{requestType.name}</div>
                    <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{requestType.description}</p>
                  </div>
                  <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
                    {requestType.workflow.steps.length} paso{requestType.workflow.steps.length === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        {selectedRequestType ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">{selectedRequestType.category}</div>
                <h3 className="mt-2 text-2xl font-semibold text-[#001534]">{selectedRequestType.name}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#1e3a5f]">{selectedRequestType.description}</p>
              </div>
              <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
                {draftStepCodes.length} paso{draftStepCodes.length === 1 ? "" : "s"} en borrador
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-sm font-semibold text-[#001534]">Secuencia actual</div>
                  <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                    Ordena los pasos segun el flujo que debe seguir la solicitud. SSD asignara automaticamente al aprobador de cada etapa.
                  </p>

                  <div className="mt-5 space-y-3">
                    {activeStepTemplates.map((step, index) => {
                      if (!step) {
                        return null;
                      }

                      return (
                        <div key={`${selectedRequestType.id}-${step.code}`} className="rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Paso {index + 1}</div>
                              <div className="mt-2 text-base font-semibold text-[#001534]">{step.label}</div>
                              <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{step.description}</p>
                            </div>
                            <StepBadge kind={step.kind} routing={step.routing} scope={step.scope ?? undefined} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => moveStep(index, "up")}
                              disabled={index === 0}
                              className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(index, "down")}
                              disabled={index === activeStepTemplates.length - 1}
                              className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Bajar
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStep(step.code)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {activeStepTemplates.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#bfd2e7] bg-white p-4 text-sm leading-7 text-[#1e3a5f]">
                        El workflow no puede quedar vacio. Agrega al menos un paso antes de guardar.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-sm font-semibold text-[#001534]">Pasos disponibles</div>
                  <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                    Agrega solo los pasos que de verdad deben intervenir en este tipo de solicitud.
                  </p>

                  <div className="mt-5 space-y-3">
                    {availableStepTemplates.map((step) => (
                      <div key={`${selectedRequestType.id}-available-${step.code}`} className="rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
                        <div className="text-base font-semibold text-[#001534]">{step.label}</div>
                        <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{step.description}</p>
                        <div className="mt-3">
                          <StepBadge kind={step.kind} routing={step.routing} scope={step.scope ?? undefined} />
                        </div>
                        <button
                          type="button"
                          onClick={() => addStep(step.code)}
                          className="mt-4 rounded-full bg-[#0b5ed7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#0847a8]"
                        >
                          Agregar paso
                        </button>
                      </div>
                    ))}

                    {availableStepTemplates.length === 0 ? (
                      <div className="rounded-[1.3rem] border border-dashed border-[#bfd2e7] bg-white p-4 text-sm leading-7 text-[#1e3a5f]">
                        Ya agregaste todos los pasos disponibles para este workflow.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-sm font-semibold text-[#001534]">Guardar cambios</div>
                  <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                    Los cambios aplican a nuevas solicitudes. Las solicitudes ya creadas conservan sus pasos historicos.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveWorkflow}
                      disabled={busy || !hasChanges || draftStepCodes.length === 0}
                      className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Guardando..." : "Guardar workflow"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftStepCodes(selectedRequestType.workflow.steps.map((step) => step.code));
                        setMessage(null);
                      }}
                      disabled={!hasChanges}
                      className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restablecer
                    </button>
                  </div>

                  {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm text-[#1e3a5f]">
            No hay tipos de solicitud disponibles para configurar.
          </div>
        )}
      </article>
    </section>
  );
}
