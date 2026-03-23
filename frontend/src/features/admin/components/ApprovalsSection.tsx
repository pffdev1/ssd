"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildApprovalRoutes,
  getApproverGroupKey,
  getRequestTypesForRoute,
  type ApprovalRouteBlueprint
} from "@/src/features/admin/lib/config";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, ApproverAssignment, RequestType, WorkflowStepTemplate } from "@/src/shared/lib/types";

function ApproverOrderBadge({ assignmentRole, index }: { assignmentRole?: string; index: number }) {
  const isPrimary = assignmentRole === "PRIMARY" || (!assignmentRole && index === 0);

  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
        isPrimary
          ? "border border-[#8ebdff] bg-[#eef5ff] text-[#0b5ed7]"
          : "border border-[#d7e4f2] bg-white text-[#1e3a5f]"
      }`}
    >
      {isPrimary ? "Principal" : `Respaldo ${index + 1}`}
    </span>
  );
}

function RouteCard({
  route,
  count,
  requestTypeCount,
  active,
  onClick
}: {
  route: ApprovalRouteBlueprint;
  count: number;
  requestTypeCount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
        active
          ? "border-[#8ebdff] bg-[#eef5ff] shadow-[0_12px_28px_rgba(11,94,215,0.08)]"
          : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#001534]">{route.heading}</div>
          <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{route.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
            {count} aprob.
          </span>
          <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
            {requestTypeCount} flujo{requestTypeCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </button>
  );
}

export function ApprovalsSection({
  currentUser,
  approvers,
  departments,
  requestTypes,
  stepTemplates,
  onApproversChange
}: {
  currentUser: AppUser;
  approvers: ApproverAssignment[];
  departments: string[];
  requestTypes: RequestType[];
  stepTemplates: WorkflowStepTemplate[];
  onApproversChange: (approvers: ApproverAssignment[]) => void;
}) {
  const routes = useMemo(() => buildApprovalRoutes(departments, stepTemplates), [departments, stepTemplates]);
  const [selectedRouteKey, setSelectedRouteKey] = useState(routes[0]?.key ?? "");
  const [search, setSearch] = useState("");
  const [editingApproverId, setEditingApproverId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"PRIMARY" | "BACKUP">("PRIMARY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!routes.length) {
      return;
    }

    if (!routes.some((route) => route.key === selectedRouteKey)) {
      setSelectedRouteKey(routes[0].key);
    }
  }, [routes, selectedRouteKey]);

  useEffect(() => {
    setEditingApproverId(null);
    setFullName("");
    setEmail("");
    setTitle("");
    setAssignmentRole("PRIMARY");
    setMessage(null);
  }, [selectedRouteKey]);

  const requestTypeMatchesByRoute = useMemo(() => {
    return new Map(routes.map((route) => [route.key, getRequestTypesForRoute(route, requestTypes)]));
  }, [requestTypes, routes]);

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return routes;
    }

    return routes.filter((route) => {
      const routeApprovers = approvers.filter((item) => getApproverGroupKey(item) === route.key);
      const relatedRequestTypes = requestTypeMatchesByRoute.get(route.key) ?? [];

      return (
        route.heading.toLowerCase().includes(normalizedSearch) ||
        route.summary.toLowerCase().includes(normalizedSearch) ||
        relatedRequestTypes.some(({ requestType }) => requestType.name.toLowerCase().includes(normalizedSearch)) ||
        routeApprovers.some(
          (item) =>
            item.full_name.toLowerCase().includes(normalizedSearch) ||
            item.email.toLowerCase().includes(normalizedSearch) ||
            item.title.toLowerCase().includes(normalizedSearch)
        )
      );
    });
  }, [approvers, requestTypeMatchesByRoute, routes, search]);

  const selectedRoute =
    routes.find((route) => route.key === selectedRouteKey) ?? filteredRoutes[0] ?? routes[0] ?? null;

  const selectedApprovers = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }

    return approvers
      .filter((item) => getApproverGroupKey(item) === selectedRoute.key)
      .sort((a, b) => {
        const leftRank = a.assignment_role === "PRIMARY" ? 0 : 1;
        const rightRank = b.assignment_role === "PRIMARY" ? 0 : 1;
        return leftRank - rightRank || a.sort_order - b.sort_order || a.full_name.localeCompare(b.full_name);
      });
  }, [approvers, selectedRoute]);
  const selectedRequestTypeMatches = selectedRoute ? requestTypeMatchesByRoute.get(selectedRoute.key) ?? [] : [];

  useEffect(() => {
    if (editingApproverId) {
      return;
    }

    const hasPrimary = selectedApprovers.some((item) => item.assignment_role === "PRIMARY");
    setAssignmentRole(hasPrimary ? "BACKUP" : "PRIMARY");
  }, [editingApproverId, selectedApprovers]);

  async function handleApproverSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRoute) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const endpoint = editingApproverId
            ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/approvers/${editingApproverId}`
            : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/approvers`;
          const response = await fetch(endpoint, {
            method: editingApproverId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              fullName,
              email,
              title,
              assignmentRole,
              roleCode: selectedRoute.roleCode,
              scope: selectedRoute.scope,
              department: selectedRoute.department
            })
          });

          const payload = (await response.json()) as { message?: string; approvers?: ApproverAssignment[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo registrar el aprobador");
          }

          return payload;
        })(),
        {
          loading: { title: editingApproverId ? "Actualizando aprobador..." : "Guardando aprobador..." },
          success: { title: editingApproverId ? "Aprobador actualizado" : "Aprobador registrado" },
          error: { title: editingApproverId ? "No se pudo actualizar" : "No se pudo registrar" }
        }
      );

      onApproversChange(data.approvers ?? approvers);
      setEditingApproverId(null);
      setFullName("");
      setEmail("");
      setTitle("");
      setAssignmentRole("PRIMARY");
      setMessage(editingApproverId ? "Aprobador actualizado correctamente." : "Aprobador guardado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function moveApprover(id: string, direction: "up" | "down") {
    const data = await runWithToast(
      (async () => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/approvers/${id}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            actorEmail: currentUser.email,
            direction
          })
        });

        const payload = (await response.json()) as { message?: string; approvers?: ApproverAssignment[] };

        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo reordenar");
        }

        return payload;
      })(),
      {
        loading: { title: "Actualizando orden..." },
        success: { title: "Orden actualizado" },
        error: { title: "No se pudo reordenar" }
      }
    );

    onApproversChange(data.approvers ?? approvers);
  }

  async function removeApprover(id: string) {
    const data = await runWithToast(
      (async () => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/approvers/${id}?actorEmail=${encodeURIComponent(currentUser.email)}`,
          {
            method: "DELETE"
          }
        );

        const payload = (await response.json()) as { message?: string; approvers?: ApproverAssignment[] };

        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo eliminar");
        }

        return payload;
      })(),
      {
        loading: { title: "Quitando aprobador..." },
        success: { title: "Aprobador removido" },
        error: { title: "No se pudo quitar" }
      }
    );

    onApproversChange(data.approvers ?? approvers);
  }

  async function setRoleAssignment(id: string, nextAssignmentRole: "PRIMARY" | "BACKUP") {
    const data = await runWithToast(
      (async () => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/approvers/${id}/assignment-role`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              assignmentRole: nextAssignmentRole
            })
          }
        );

        const payload = (await response.json()) as { message?: string; approvers?: ApproverAssignment[] };

        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo actualizar el responsable");
        }

        return payload;
      })(),
      {
        loading: { title: "Actualizando responsable..." },
        success: { title: nextAssignmentRole === "PRIMARY" ? "Principal actualizado" : "Respaldo actualizado" },
        error: { title: "No se pudo actualizar el responsable" }
      }
    );

    onApproversChange(data.approvers ?? approvers);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Responsables por ruta</div>
        <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Asignacion operativa</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
          Esta seccion sigue siendo necesaria porque define que persona real atiende cada paso del workflow. Aqui administras el principal, sus respaldos y las altas, ediciones o eliminaciones de responsables.
        </p>

        <input
          className="mt-6 w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar ruta, responsable, correo o cargo"
        />

        <div className="mt-5 space-y-3">
          {filteredRoutes.map((route) => {
            const routeCount = approvers.filter((item) => getApproverGroupKey(item) === route.key).length;
            const requestTypeCount = requestTypeMatchesByRoute.get(route.key)?.length ?? 0;

            return (
              <RouteCard
                key={route.key}
                route={route}
                count={routeCount}
                requestTypeCount={requestTypeCount}
                active={route.key === selectedRoute?.key}
                onClick={() => {
                  setSelectedRouteKey(route.key);
                  setMessage(null);
                }}
              />
            );
          })}

          {filteredRoutes.length === 0 ? (
            <div className="rounded-[1.3rem] border border-[#d7e4f2] bg-[#f9fbff] p-4 text-sm text-[#1e3a5f]">
              No hay rutas que coincidan con la busqueda.
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        {selectedRoute ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">{selectedRoute.scope}</div>
                <h3 className="mt-2 text-2xl font-semibold text-[#001534]">{selectedRoute.heading}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#1e3a5f]">{selectedRoute.summary}</p>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#1e3a5f]">
                  Gestiona aqui quien aprueba este paso: puedes agregar, editar, reordenar, definir principal o eliminar respaldos.
                </p>
              </div>
              <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
                {selectedApprovers.length} responsable{selectedApprovers.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Participa en estos tipos de solicitud</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedRequestTypeMatches.map(({ requestType, step }) => (
                      <div
                        key={`${selectedRoute.key}-${requestType.code}`}
                        className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-sm text-[#1e3a5f]"
                      >
                        {requestType.name} | {step.label}
                      </div>
                    ))}
                    {selectedRequestTypeMatches.length === 0 ? (
                      <div className="text-sm leading-7 text-[#1e3a5f]">
                        Esta ruta aun no participa en ningun workflow activo.
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedApprovers.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm leading-7 text-[#1e3a5f]">
                    Esta ruta todavia no tiene responsables asignados. Registra primero al principal y luego, si quieres, agrega respaldos.
                  </div>
                ) : null}

                {selectedApprovers.map((item, index) => (
                  <div key={item.id} className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[#001534]">{item.full_name}</div>
                        <div className="mt-1 text-sm text-[#1e3a5f]">{item.email}</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">{item.title}</div>
                      </div>
                      <ApproverOrderBadge assignmentRole={item.assignment_role} index={index} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.assignment_role !== "PRIMARY" ? (
                        <button
                          type="button"
                          onClick={() => setRoleAssignment(item.id, "PRIMARY")}
                          className="rounded-full border border-[#8ebdff] bg-[#eef5ff] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0b5ed7] transition hover:bg-[#dfeeff]"
                        >
                          Definir principal
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRoleAssignment(item.id, "BACKUP")}
                          disabled={selectedApprovers.filter((approver) => approver.assignment_role === "PRIMARY").length === 1 && selectedApprovers.length === 1}
                          className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Marcar respaldo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingApproverId(item.id);
                          setFullName(item.full_name);
                          setEmail(item.email);
                          setTitle(item.title);
                          setAssignmentRole(item.assignment_role === "BACKUP" ? "BACKUP" : "PRIMARY");
                          setMessage(`Editando aprobador: ${item.full_name}`);
                        }}
                        className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                      >
                        Editar responsable
                      </button>
                      <button
                        type="button"
                        onClick={() => moveApprover(item.id, "up")}
                        disabled={index === 0}
                        className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => moveApprover(item.id, "down")}
                        disabled={index === selectedApprovers.length - 1}
                        className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Bajar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeApprover(item.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
                <div className="text-sm font-semibold text-[#001534]">
                  {editingApproverId ? "Editar responsable de la ruta" : "Agregar responsable a la ruta"}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                  {editingApproverId ? "Actualiza los datos visibles del responsable asignado a " : "Nuevo registro para "}
                  {selectedRoute.roleLabel}
                  {selectedRoute.department ? ` en ${selectedRoute.department}` : ""}.
                </p>

                <form className="mt-5 space-y-4" onSubmit={handleApproverSubmit}>
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nombre completo"
                    required
                  />
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="correo@pffsa.com"
                    type="email"
                    required
                  />
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Cargo visible"
                    required
                  />
                  <select
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={assignmentRole}
                    onChange={(event) => setAssignmentRole(event.target.value as "PRIMARY" | "BACKUP")}
                  >
                    <option value="PRIMARY">Principal</option>
                    <option value="BACKUP">Respaldo</option>
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
                  >
                    {busy ? "Guardando..." : editingApproverId ? "Actualizar responsable" : "Agregar responsable"}
                  </button>
                  {editingApproverId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingApproverId(null);
                        setFullName("");
                        setEmail("");
                        setTitle("");
                        setAssignmentRole("PRIMARY");
                        setMessage(null);
                      }}
                      className="ml-3 rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </form>

                {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm text-[#1e3a5f]">
            No hay rutas disponibles para configurar.
          </div>
        )}
      </article>
    </section>
  );
}
