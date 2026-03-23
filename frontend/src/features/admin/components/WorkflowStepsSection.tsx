"use client";

import { useEffect, useMemo, useState } from "react";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, RequestType, WorkflowStepTemplate } from "@/src/shared/lib/types";

function StepBadge({
  children,
  tone = "default"
}: {
  children: string;
  tone?: "default" | "active" | "inactive";
}) {
  const toneClass =
    tone === "active"
      ? "border-[#8ebdff] bg-[#eef5ff] text-[#0b5ed7]"
      : tone === "inactive"
        ? "border-slate-200 bg-slate-100 text-slate-500"
        : "border-[#d7e4f2] bg-white text-[#1e3a5f]";

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {children}
    </span>
  );
}

function countStepUsage(stepCode: string, requestTypes: RequestType[]) {
  return requestTypes.filter((requestType) => requestType.workflow.steps.some((step) => step.code === stepCode)).length;
}

export function WorkflowStepsSection({
  currentUser,
  requestTypes,
  stepTemplates,
  onStepTemplatesChange
}: {
  currentUser: AppUser;
  requestTypes: RequestType[];
  stepTemplates: WorkflowStepTemplate[];
  onStepTemplatesChange: (steps: WorkflowStepTemplate[]) => void;
}) {
  const orderedSteps = useMemo(
    () => [...stepTemplates].sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label)),
    [stepTemplates]
  );
  const [selectedStepId, setSelectedStepId] = useState(orderedSteps[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("10");
  const [createCode, setCreateCode] = useState("");
  const [createLabel, setCreateLabel] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createKind, setCreateKind] = useState<"approval" | "fulfillment">("approval");
  const [createRouting, setCreateRouting] = useState<"department" | "scope" | "requester_unit">("scope");
  const [createScope, setCreateScope] = useState("CUSTOM");
  const [createSortOrder, setCreateSortOrder] = useState("999");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderedSteps.length) {
      return;
    }

    if (!orderedSteps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(orderedSteps[0].id);
    }
  }, [orderedSteps, selectedStepId]);

  const selectedStep = orderedSteps.find((step) => step.id === selectedStepId) ?? orderedSteps[0] ?? null;

  useEffect(() => {
    if (!selectedStep) {
      setLabel("");
      setDescription("");
      setActive(true);
      setSortOrder("10");
      return;
    }

    setLabel(selectedStep.label);
    setDescription(selectedStep.description);
    setActive(selectedStep.active);
    setSortOrder(String(selectedStep.sort_order));
    setMessage(null);
  }, [selectedStep?.id]);

  const relatedRequestTypes = useMemo(() => {
    if (!selectedStep) {
      return [];
    }

    return requestTypes.filter((requestType) => requestType.workflow.steps.some((step) => step.code === selectedStep.code));
  }, [requestTypes, selectedStep]);

  const hasChanges =
    Boolean(selectedStep) &&
    (label !== selectedStep.label ||
      description !== selectedStep.description ||
      active !== selectedStep.active ||
      Number(sortOrder || 0) !== selectedStep.sort_order);

  async function saveStep() {
    if (!selectedStep) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/workflow-steps/${selectedStep.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                actorEmail: currentUser.email,
                label,
                description,
                active,
                sortOrder: Number(sortOrder || 0)
              })
            }
          );

          const payload = (await response.json()) as { message?: string; steps?: WorkflowStepTemplate[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo actualizar el paso");
          }

          return payload;
        })(),
        {
          loading: { title: "Guardando paso..." },
          success: { title: "Paso actualizado" },
          error: { title: "No se pudo actualizar el paso" }
        }
      );

      onStepTemplatesChange(data.steps ?? stepTemplates);
      setMessage("Paso actualizado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function createStep() {
    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/workflow-steps`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              code: createCode,
              label: createLabel,
              description: createDescription,
              kind: createKind,
              routing: createRouting,
              scope: createRouting === "scope" ? createScope : null,
              sortOrder: Number(createSortOrder || 999)
            })
          });

          const payload = (await response.json()) as { message?: string; created?: WorkflowStepTemplate; steps?: WorkflowStepTemplate[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo crear el paso");
          }

          return payload;
        })(),
        {
          loading: { title: "Creando paso..." },
          success: { title: "Paso creado" },
          error: { title: "No se pudo crear el paso" }
        }
      );

      const nextSteps = data.steps ?? stepTemplates;
      onStepTemplatesChange(nextSteps);
      if (data.created) {
        setSelectedStepId(data.created.id);
      }
      setCreateCode("");
      setCreateLabel("");
      setCreateDescription("");
      setCreateKind("approval");
      setCreateRouting("scope");
      setCreateScope("CUSTOM");
      setCreateSortOrder("999");
      setMessage("Paso creado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStep() {
    if (!selectedStep) {
      return;
    }

    const confirmed = window.confirm(`Se eliminara el paso ${selectedStep.label}. Esta accion no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/workflow-steps/${selectedStep.id}?actorEmail=${encodeURIComponent(currentUser.email)}`,
            {
              method: "DELETE"
            }
          );

          const payload = (await response.json()) as { message?: string; steps?: WorkflowStepTemplate[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo eliminar el paso");
          }

          return payload;
        })(),
        {
          loading: { title: "Eliminando paso..." },
          success: { title: "Paso eliminado" },
          error: { title: "No se pudo eliminar el paso" }
        }
      );

      const nextSteps = data.steps ?? [];
      onStepTemplatesChange(nextSteps);
      setSelectedStepId(nextSteps[0]?.id ?? "");
      setMessage("Paso eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Biblioteca de pasos</div>
        <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Catalogo reusable del workflow</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
          Aqui administras el nombre, la descripcion y la disponibilidad de cada paso estandar. El orden real por solicitud se
          controla en la seccion de workflows.
        </p>

        <div className="mt-6 rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
          <div className="text-sm font-semibold text-[#001534]">Crear nuevo paso</div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                value={createCode}
                onChange={(event) => setCreateCode(event.target.value)}
                placeholder="Codigo tecnico. Ej: LEGAL_REVIEW"
              />
              <input
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                value={createLabel}
                onChange={(event) => setCreateLabel(event.target.value)}
                placeholder="Etiqueta visible"
              />
            </div>

            <textarea
              className="min-h-24 w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Descripcion operativa del paso"
            />

            <div className="grid gap-4 md:grid-cols-4">
              <select
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                value={createKind}
                onChange={(event) => setCreateKind(event.target.value as "approval" | "fulfillment")}
              >
                <option value="approval">Aprobacion</option>
                <option value="fulfillment">Ejecucion</option>
              </select>
              <select
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                value={createRouting}
                onChange={(event) => setCreateRouting(event.target.value as "department" | "scope" | "requester_unit")}
              >
                <option value="scope">Por scope</option>
                <option value="department">Por departamento</option>
                <option value="requester_unit">Supervisor del departamento</option>
              </select>
              <input
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7] disabled:bg-slate-100"
                value={createScope}
                onChange={(event) => setCreateScope(event.target.value)}
                placeholder="Scope. Ej: LEGAL"
                disabled={createRouting !== "scope"}
              />
              <input
                className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                type="number"
                min="1"
                value={createSortOrder}
                onChange={(event) => setCreateSortOrder(event.target.value)}
                placeholder="Orden"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={createStep}
                disabled={busy || !createCode || !createLabel || !createDescription || (createRouting === "scope" && !createScope)}
                className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear paso
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {orderedSteps.map((step) => {
            const activeCard = step.id === selectedStep?.id;
            const usageCount = countStepUsage(step.code, requestTypes);

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setSelectedStepId(step.id)}
                className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                  activeCard
                    ? "border-[#8ebdff] bg-[#eef5ff] shadow-[0_12px_28px_rgba(11,94,215,0.08)]"
                    : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#001534]">{step.label}</div>
                    <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{step.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StepBadge tone={step.active ? "active" : "inactive"}>{step.active ? "Activo" : "Inactivo"}</StepBadge>
                    <StepBadge>{`${usageCount} flujo${usageCount === 1 ? "" : "s"}`}</StepBadge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        {selectedStep ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">{selectedStep.code}</div>
                <h3 className="mt-2 text-2xl font-semibold text-[#001534]">{selectedStep.label}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#1e3a5f]">{selectedStep.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StepBadge>{selectedStep.kind === "approval" ? "Aprobacion" : "Ejecucion"}</StepBadge>
                <StepBadge>
                  {selectedStep.routing === "department"
                    ? "Por departamento"
                    : selectedStep.routing === "requester_unit"
                      ? "Supervisor del departamento"
                      : selectedStep.scope ?? "Scope"}
                </StepBadge>
                <StepBadge tone={selectedStep.active ? "active" : "inactive"}>{selectedStep.active ? "Activo" : "Inactivo"}</StepBadge>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                <div className="text-sm font-semibold text-[#001534]">Definicion del paso</div>
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-[#1e3a5f]">Etiqueta visible</label>
                    <input
                      className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-[#1e3a5f]">Descripcion operativa</label>
                    <textarea
                      className="min-h-32 w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.7fr_0.3fr]">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-[#1e3a5f]">Orden de aparicion</label>
                      <input
                        className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                        type="number"
                        min="1"
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value)}
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-[#d7e4f2] bg-white px-4 py-3 text-sm text-[#1e3a5f]">
                      <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[#0b5ed7]" />
                      Activo
                    </label>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveStep}
                    disabled={busy || !hasChanges}
                    className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Guardando..." : "Guardar paso"}
                  </button>
                  <button
                    type="button"
                    disabled={!hasChanges}
                    onClick={() => {
                      setLabel(selectedStep.label);
                      setDescription(selectedStep.description);
                      setActive(selectedStep.active);
                      setSortOrder(String(selectedStep.sort_order));
                      setMessage(null);
                    }}
                    className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={deleteStep}
                    disabled={busy}
                    className="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Eliminar paso
                  </button>
                </div>

                {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-sm font-semibold text-[#001534]">Uso actual</div>
                  <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                    Estos tipos de solicitud ya usan este paso. Si lo desactivas, dejara de aparecer como opcion nueva en workflows, pero las
                    configuraciones actuales seguiran funcionando.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {relatedRequestTypes.map((requestType) => (
                      <div key={`${selectedStep.code}-${requestType.code}`} className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-sm text-[#1e3a5f]">
                        {requestType.name}
                      </div>
                    ))}
                    {relatedRequestTypes.length === 0 ? (
                      <div className="text-sm leading-7 text-[#1e3a5f]">Todavia no hay workflows usando este paso.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-sm font-semibold text-[#001534]">Datos tecnicos</div>
                  <div className="mt-4 space-y-3 text-sm text-[#1e3a5f]">
                    <div className="rounded-2xl border border-[#d7e4f2] bg-white px-4 py-3">
                      <strong className="text-[#001534]">Codigo:</strong> {selectedStep.code}
                    </div>
                    <div className="rounded-2xl border border-[#d7e4f2] bg-white px-4 py-3">
                      <strong className="text-[#001534]">Tipo:</strong> {selectedStep.kind}
                    </div>
                    <div className="rounded-2xl border border-[#d7e4f2] bg-white px-4 py-3">
                      <strong className="text-[#001534]">Ruteo:</strong>{" "}
                      {selectedStep.routing === "department"
                        ? "Por departamento"
                        : selectedStep.routing === "requester_unit"
                          ? "Supervisor del departamento"
                          : `Scope ${selectedStep.scope ?? "N/A"}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm text-[#1e3a5f]">
            No hay pasos disponibles para administrar.
          </div>
        )}
      </article>
    </section>
  );
}
