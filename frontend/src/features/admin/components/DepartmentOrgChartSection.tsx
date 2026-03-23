"use client";

import { useEffect, useMemo, useState } from "react";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, ApproverAssignment, EmployeeProfile, OrgUnit, WorkflowStepTemplate } from "@/src/shared/lib/types";

const unitTypeOptions = [
  { value: "company", label: "Empresa" },
  { value: "division", label: "Division" },
  { value: "gerencia", label: "Gerencia" },
  { value: "jefatura", label: "Jefatura" },
  { value: "departamento", label: "Departamento" }
] as const;

function getUnitTypeLabel(value: string) {
  return unitTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function getScopeCandidates(unit: OrgUnit) {
  const normalizedName = unit.name.toLowerCase();
  const scopes: string[] = [];

  if (normalizedName.includes("gerencia general")) {
    scopes.push("GG");
  }

  if (normalizedName.includes("finanzas") || normalizedName.includes("contabilidad")) {
    scopes.push("FINANCE");
  }

  if (normalizedName.includes("proyectos") || normalizedName.includes("it") || normalizedName.includes("tecnologia")) {
    scopes.push("IT");
  }

  if (normalizedName.includes("recursos humanos") || normalizedName.includes("rrhh")) {
    scopes.push("HR");
  }

  if (normalizedName.includes("compra")) {
    scopes.push("PROCUREMENT");
  }

  return scopes;
}

function matchesOrgUnit(approver: ApproverAssignment, unit: OrgUnit) {
  if (approver.org_unit_id === unit.id) {
    return true;
  }

  if (approver.department === unit.name) {
    return true;
  }

  if (!approver.org_unit_id && !approver.department) {
    return getScopeCandidates(unit).includes(approver.scope);
  }

  return false;
}

function OrgNode({
  unit,
  level,
  active,
  approverSummary,
  onSelect,
  children
}: {
  unit: OrgUnit;
  level: number;
  active: boolean;
  approverSummary: string;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3" style={{ paddingLeft: `${Math.min(level, 5) * 14}px` }}>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full min-w-0 items-start gap-4 rounded-[1.5rem] border p-4 text-left transition ${
          active ? "border-[#0b5ed7] bg-[#eef5ff] shadow-[0_18px_42px_rgba(11,94,215,0.14)]" : "border-[#d7e4f2] bg-white hover:bg-[#f8fbff]"
        }`}
      >
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eaf6ff] text-[#0b5ed7]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
            <path d="M12 4v4" />
            <path d="M5 10h14" />
            <path d="M7 10v8" />
            <path d="M12 10v8" />
            <path d="M17 10v8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-[#001534]">{unit.name}</div>
            <span className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#1e3a5f]">
              {getUnitTypeLabel(unit.unit_type)}
            </span>
          </div>
          <div className="mt-2 text-sm leading-6 text-[#1e3a5f]">{approverSummary}</div>
        </div>
      </button>

      {children ? <div className="space-y-3 border-l border-[#d7e4f2] pl-4">{children}</div> : null}
    </div>
  );
}

export function DepartmentOrgChartSection({
  currentUser,
  orgUnits,
  approvers,
  employeeProfiles,
  stepTemplates,
  onApproversChange,
  onEmployeeProfilesChange,
  onOrgUnitsChange
}: {
  currentUser: AppUser;
  orgUnits: OrgUnit[];
  approvers: ApproverAssignment[];
  employeeProfiles: EmployeeProfile[];
  stepTemplates: WorkflowStepTemplate[];
  onApproversChange: (items: ApproverAssignment[]) => void;
  onEmployeeProfilesChange: (items: EmployeeProfile[]) => void;
  onOrgUnitsChange: (items: OrgUnit[]) => void;
}) {
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<(typeof unitTypeOptions)[number]["value"]>("departamento");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingApproverId, setEditingApproverId] = useState<string | null>(null);
  const [stepCode, setStepCode] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverTitle, setApproverTitle] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"PRIMARY" | "BACKUP">("PRIMARY");
  const [approverBusy, setApproverBusy] = useState(false);
  const [approverMessage, setApproverMessage] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeTitle, setEmployeeTitle] = useState("");
  const [employeeReportsToId, setEmployeeReportsToId] = useState("");
  const [employeeSortOrder, setEmployeeSortOrder] = useState("10");
  const [employeeBusy, setEmployeeBusy] = useState(false);
  const [employeeMessage, setEmployeeMessage] = useState<string | null>(null);

  const sortedUnits = useMemo(
    () => [...orgUnits].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)),
    [orgUnits]
  );

  const rootUnits = useMemo(() => sortedUnits.filter((item) => !item.parent_id), [sortedUnits]);
  const unitMap = useMemo(() => new Map(sortedUnits.map((item) => [item.id, item])), [sortedUnits]);
  const selectedUnit = sortedUnits.find((item) => item.id === editingUnitId) ?? null;
  const availableStepTemplates = useMemo(() => {
    if (!selectedUnit) {
      return [];
    }

    const scopeCandidates = getScopeCandidates(selectedUnit);

    return [...stepTemplates]
      .filter((template) => {
        if (!template.active) {
          return false;
        }

        if (template.routing === "department") {
          return selectedUnit.unit_type === "departamento";
        }

        if (template.routing === "requester_unit") {
          return selectedUnit.unit_type === "departamento";
        }

        return scopeCandidates.includes(template.scope ?? "");
      })
      .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));
  }, [selectedUnit, stepTemplates]);

  const selectedUnitApprovers = useMemo(() => {
    if (!selectedUnit) {
      return [];
    }

    return approvers
      .filter((item) => matchesOrgUnit(item, selectedUnit))
      .sort((left, right) => {
        const leftTemplate = stepTemplates.find((step) => step.code === left.role_code);
        const rightTemplate = stepTemplates.find((step) => step.code === right.role_code);
        const leftRank = left.assignment_role === "PRIMARY" ? 0 : 1;
        const rightRank = right.assignment_role === "PRIMARY" ? 0 : 1;

        return (
          (leftTemplate?.sort_order ?? 999) - (rightTemplate?.sort_order ?? 999) ||
          left.role_code.localeCompare(right.role_code) ||
          leftRank - rightRank ||
          left.sort_order - right.sort_order ||
          left.full_name.localeCompare(right.full_name)
        );
      });
  }, [approvers, selectedUnit, stepTemplates]);

  const selectedUnitEmployees = useMemo(() => {
    if (!selectedUnit) {
      return [];
    }

    return employeeProfiles
      .filter((item) => item.org_unit_id === selectedUnit.id)
      .sort((left, right) => left.sort_order - right.sort_order || left.full_name.localeCompare(right.full_name));
  }, [employeeProfiles, selectedUnit]);

  const selectedRoleApprovers = useMemo(
    () => selectedUnitApprovers.filter((item) => item.role_code === stepCode),
    [selectedUnitApprovers, stepCode]
  );

  const groupedApprovers = useMemo(() => {
    const groups = new Map<string, ApproverAssignment[]>();

    for (const approver of selectedUnitApprovers) {
      const current = groups.get(approver.role_code) ?? [];
      current.push(approver);
      groups.set(approver.role_code, current);
    }

    return [...groups.entries()]
      .map(([roleCode, items]) => ({
        roleCode,
        stepTemplate: stepTemplates.find((step) => step.code === roleCode),
        items: [...items].sort((left, right) => {
          const leftRank = left.assignment_role === "PRIMARY" ? 0 : 1;
          const rightRank = right.assignment_role === "PRIMARY" ? 0 : 1;
          return leftRank - rightRank || left.sort_order - right.sort_order || left.full_name.localeCompare(right.full_name);
        })
      }))
      .sort((left, right) => {
        const leftOrder = left.stepTemplate?.sort_order ?? 999;
        const rightOrder = right.stepTemplate?.sort_order ?? 999;
        return leftOrder - rightOrder || (left.stepTemplate?.label ?? left.roleCode).localeCompare(right.stepTemplate?.label ?? right.roleCode);
      });
  }, [selectedUnitApprovers, stepTemplates]);

  const selectedPath = useMemo(() => {
    if (!selectedUnit) {
      return [] as OrgUnit[];
    }

    const path: OrgUnit[] = [];
    let cursor: OrgUnit | undefined | null = selectedUnit;

    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parent_id ? unitMap.get(cursor.parent_id) ?? null : null;
    }

    return path;
  }, [selectedUnit, unitMap]);

  function getChildren(parentUnitId: string) {
    return sortedUnits.filter((item) => item.parent_id === parentUnitId);
  }

  function getRelatedApprovers(unit: OrgUnit) {
    return approvers
      .filter((item) => matchesOrgUnit(item, unit))
      .sort((left, right) => {
        const leftRank = left.assignment_role === "PRIMARY" ? 0 : 1;
        const rightRank = right.assignment_role === "PRIMARY" ? 0 : 1;
        return leftRank - rightRank || left.sort_order - right.sort_order || left.full_name.localeCompare(right.full_name);
      });
  }

  function getApproverSummary(unit: OrgUnit) {
    const relatedApprovers = getRelatedApprovers(unit);
    const childCount = getChildren(unit.id).length;
    const primary = relatedApprovers.find((item) => item.assignment_role === "PRIMARY") ?? null;
    const backups = relatedApprovers.filter((item) => item.assignment_role !== "PRIMARY").length;

    if (!primary) {
      if (childCount > 0) {
        return `${childCount} unidad${childCount === 1 ? "" : "es"} subordinada${childCount === 1 ? "" : "s"} y sin responsable principal configurado`;
      }

      return "Sin responsable principal configurado";
    }

    return `${primary.full_name} como principal${backups > 0 ? ` y ${backups} respaldo${backups === 1 ? "" : "s"}` : ""}`;
  }

  function resetForm(baseUnits = sortedUnits) {
    setEditingUnitId(null);
    setUnitName("");
    setUnitType("departamento");
    setParentId("");
    setSortOrder(String((baseUnits.at(-1)?.sort_order ?? 0) + 10));
  }

  function resetApproverForm(nextStepCode?: string) {
    setEditingApproverId(null);
    setApproverName("");
    setApproverEmail("");
    setApproverTitle("");
    setAssignmentRole("PRIMARY");
    setStepCode(nextStepCode ?? availableStepTemplates[0]?.code ?? "");
    setApproverMessage(null);
  }

  function resetEmployeeForm() {
    setEditingEmployeeId(null);
    setEmployeeName("");
    setEmployeeEmail("");
    setEmployeeTitle("");
    setEmployeeReportsToId("");
    setEmployeeSortOrder(String((selectedUnitEmployees.at(-1)?.sort_order ?? 0) + 10));
    setEmployeeMessage(null);
  }

  useEffect(() => {
    if (!selectedUnit) {
      resetApproverForm();
      resetEmployeeForm();
      return;
    }

    resetApproverForm(availableStepTemplates[0]?.code);
    resetEmployeeForm();
  }, [selectedUnit?.id, availableStepTemplates.length, selectedUnitEmployees.length]);

  useEffect(() => {
    if (editingApproverId) {
      return;
    }

    if (!stepCode && availableStepTemplates.length > 0) {
      setStepCode(availableStepTemplates[0].code);
      return;
    }

    const hasPrimary = selectedRoleApprovers.some((item) => item.assignment_role === "PRIMARY");
    setAssignmentRole(hasPrimary ? "BACKUP" : "PRIMARY");
  }, [availableStepTemplates, editingApproverId, selectedRoleApprovers, stepCode]);

  async function updateAssignmentRole(id: string, assignmentRole: "PRIMARY" | "BACKUP") {
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
              assignmentRole
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
        success: { title: assignmentRole === "PRIMARY" ? "Principal actualizado" : "Respaldo actualizado" },
        error: { title: "No se pudo actualizar el responsable" }
      }
    );

    onApproversChange(data.approvers ?? approvers);
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
          throw new Error(payload.message ?? "No se pudo eliminar el responsable");
        }

        return payload;
      })(),
      {
        loading: { title: "Eliminando responsable..." },
        success: { title: "Responsable eliminado" },
        error: { title: "No se pudo eliminar el responsable" }
      }
    );

    onApproversChange(data.approvers ?? approvers);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const payload = {
        actorEmail: currentUser.email,
        name: unitName.trim(),
        unitType,
        parentId: parentId || null,
        sortOrder: Number(sortOrder)
      };

      const data = await runWithToast(
        (async () => {
          const endpoint = editingUnitId
            ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/org-units/${editingUnitId}`
            : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/org-units`;

          const response = await fetch(endpoint, {
            method: editingUnitId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          const nextPayload = (await response.json()) as { message?: string; units?: OrgUnit[] };

          if (!response.ok) {
            throw new Error(nextPayload.message ?? "No se pudo guardar la unidad");
          }

          return nextPayload;
        })(),
        {
          loading: { title: editingUnitId ? "Actualizando unidad..." : "Creando unidad..." },
          success: { title: editingUnitId ? "Unidad actualizada" : "Unidad creada" },
          error: { title: "No se pudo guardar la unidad" }
        }
      );

      const nextUnits = data.units ?? orgUnits;
      onOrgUnitsChange(nextUnits);
      setMessage(editingUnitId ? "Unidad actualizada correctamente." : "Unidad agregada correctamente.");
      resetForm(nextUnits);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproverSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUnit) {
      return;
    }

    const selectedStepTemplate =
      availableStepTemplates.find((template) => template.code === stepCode) ??
      stepTemplates.find((template) => template.code === stepCode);

    if (!selectedStepTemplate) {
      setApproverMessage("Debes seleccionar un paso valido para esta unidad.");
      return;
    }

    setApproverBusy(true);
    setApproverMessage(null);

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
                fullName: approverName,
                email: approverEmail,
                title: approverTitle,
                assignmentRole,
                roleCode: selectedStepTemplate.code,
                scope:
                  selectedStepTemplate.routing === "scope"
                    ? selectedStepTemplate.scope ?? selectedStepTemplate.code
                    : selectedStepTemplate.routing === "department"
                      ? "AREA"
                      : "ORG_UNIT",
                department:
                  selectedStepTemplate.routing === "scope"
                    ? null
                    : selectedUnit.unit_type === "departamento"
                      ? selectedUnit.name
                      : null,
                orgUnitId: selectedUnit.id
              })
          });

          const payload = (await response.json()) as { message?: string; approvers?: ApproverAssignment[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo guardar el responsable");
          }

          return payload;
        })(),
        {
          loading: { title: editingApproverId ? "Actualizando responsable..." : "Guardando responsable..." },
          success: { title: editingApproverId ? "Responsable actualizado" : "Responsable registrado" },
          error: { title: "No se pudo guardar el responsable" }
        }
      );

      onApproversChange(data.approvers ?? approvers);
      setApproverMessage(editingApproverId ? "Responsable actualizado correctamente." : "Responsable agregado correctamente.");
      resetApproverForm(stepCode);
    } catch (error) {
      setApproverMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setApproverBusy(false);
    }
  }

  async function handleEmployeeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUnit) {
      return;
    }

    setEmployeeBusy(true);
    setEmployeeMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const endpoint = editingEmployeeId
            ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/employee-profiles/${editingEmployeeId}`
            : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/employee-profiles`;

          const response = await fetch(endpoint, {
            method: editingEmployeeId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              fullName: employeeName,
              email: employeeEmail || null,
              title: employeeTitle,
              orgUnitId: selectedUnit.id,
              reportsToProfileId: employeeReportsToId || null,
              sortOrder: Number(employeeSortOrder || 0)
            })
          });

          const payload = (await response.json()) as { message?: string; profiles?: EmployeeProfile[] };

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo guardar el colaborador");
          }

          return payload;
        })(),
        {
          loading: { title: editingEmployeeId ? "Actualizando colaborador..." : "Guardando colaborador..." },
          success: { title: editingEmployeeId ? "Colaborador actualizado" : "Colaborador registrado" },
          error: { title: "No se pudo guardar el colaborador" }
        }
      );

      onEmployeeProfilesChange(data.profiles ?? employeeProfiles);
      setEmployeeMessage(editingEmployeeId ? "Colaborador actualizado correctamente." : "Colaborador agregado correctamente.");
      resetEmployeeForm();
    } catch (error) {
      setEmployeeMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setEmployeeBusy(false);
    }
  }

  async function removeEmployee(id: string) {
    const data = await runWithToast(
      (async () => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/admin/employee-profiles/${id}?actorEmail=${encodeURIComponent(currentUser.email)}`,
          {
            method: "DELETE"
          }
        );

        const payload = (await response.json()) as { message?: string; profiles?: EmployeeProfile[] };

        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo eliminar el colaborador");
        }

        return payload;
      })(),
      {
        loading: { title: "Eliminando colaborador..." },
        success: { title: "Colaborador eliminado" },
        error: { title: "No se pudo eliminar el colaborador" }
      }
    );

    onEmployeeProfilesChange(data.profiles ?? employeeProfiles);
  }

  function renderTree(unit: OrgUnit, level = 0): React.ReactNode {
    const children = getChildren(unit.id);

    return (
      <OrgNode
        key={unit.id}
        unit={unit}
        level={level}
        active={editingUnitId === unit.id}
        approverSummary={getApproverSummary(unit)}
        onSelect={() => {
          setEditingUnitId(unit.id);
          setUnitName(unit.name);
          setUnitType(unit.unit_type as (typeof unitTypeOptions)[number]["value"]);
          setParentId(unit.parent_id ?? "");
          setSortOrder(String(unit.sort_order));
          setMessage(`Editando unidad: ${unit.name}`);
        }}
      >
        {children.map((child) => renderTree(child, level + 1))}
      </OrgNode>
    );
  }

  const selectableParents = sortedUnits.filter((item) => item.id !== editingUnitId);
  const directChildren = selectedUnit ? getChildren(selectedUnit.id) : [];

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <article className="overflow-hidden rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Organigrama</div>
            <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Estructura organizacional y responsables</h3>
            <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
              Administra la jerarquia oficial del SSD y absorbe desde aqui la gestion de responsables. Cada unidad puede atender los pasos que le corresponden por jerarquia.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
              {sortedUnits.length} unidad{sortedUnits.length === 1 ? "" : "es"}
            </div>
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                resetForm();
              }}
              className="rounded-full border border-[#bfd2e7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#1e3a5f] transition hover:bg-[#eef5ff]"
            >
              Nueva unidad
            </button>
          </div>
        </div>

        {selectedPath.length > 0 ? (
          <div className="mt-6 rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Vista actual</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selectedPath.map((unit, index) => (
                <div key={unit.id} className="flex items-center gap-2">
                  <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-xs font-semibold text-[#1e3a5f]">
                    {unit.name}
                  </span>
                  {index < selectedPath.length - 1 ? <span className="text-slate-400">/</span> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Nivel</div>
                <div className="mt-2 text-sm font-semibold text-[#001534]">{getUnitTypeLabel(selectedUnit?.unit_type ?? "departamento")}</div>
              </div>
              <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Subunidades directas</div>
                <div className="mt-2 text-sm font-semibold text-[#001534]">{directChildren.length}</div>
              </div>
              <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Responsables directos</div>
                <div className="mt-2 text-sm font-semibold text-[#001534]">{selectedUnitApprovers.length}</div>
              </div>
              <div className="rounded-2xl border border-[#d7e4f2] bg-white p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cobertura del flujo</div>
                <div className="mt-2 text-sm font-semibold text-[#001534]">
                  {selectedUnitApprovers.some((item) => item.assignment_role === "PRIMARY") ? "Cubierto" : "Pendiente"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 overflow-x-hidden">
          <div className="space-y-4">{rootUnits.map((unit) => renderTree(unit))}</div>
        </div>
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">
          {editingUnitId ? "Editar unidad" : "Nueva unidad"}
        </div>
        <h3 className="mt-3 text-xl font-semibold text-[#001534]">{editingUnitId ? unitName : "Registrar nodo del organigrama"}</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">
          Usa esta vista para estructurar el organigrama y definir responsables por departamento. SSD tomara la jefatura inmediata desde el responsable principal configurado aqui.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
            placeholder="Nombre de la unidad"
            required
          />

          <select
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={unitType}
            onChange={(event) => setUnitType(event.target.value as (typeof unitTypeOptions)[number]["value"])}
            required
          >
            {unitTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Sin padre / raiz</option>
            {selectableParents.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({getUnitTypeLabel(unit.unit_type)})
              </option>
            ))}
          </select>

          <input
            className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            type="number"
            placeholder="Orden"
            required
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
            >
              {busy ? "Guardando..." : editingUnitId ? "Actualizar unidad" : "Agregar unidad"}
            </button>
            {editingUnitId ? (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  resetForm();
                }}
                className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff]"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {selectedUnit ? (
          <div className="mt-6 rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#001534]">Responsables de la unidad</div>
                <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                  Aqui administras completamente los responsables de <strong className="text-[#001534]">{selectedUnit.name}</strong>: altas, ediciones, principal, respaldos, orden y eliminacion.
                </p>
              </div>
              <div className="rounded-full border border-[#d7e4f2] bg-white px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
                {selectedUnitApprovers.length} responsable{selectedUnitApprovers.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {groupedApprovers.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#bfd2e7] bg-white p-4 text-sm leading-7 text-[#1e3a5f]">
                  Esta unidad aun no tiene responsables asignados para sus pasos disponibles.
                </div>
              ) : null}

              {groupedApprovers.map((group) => (
                <div key={group.roleCode} className="rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#001534]">{group.stepTemplate?.label ?? group.roleCode}</div>
                      <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{group.stepTemplate?.description ?? "Responsables asignados a este paso."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
                        {group.stepTemplate?.kind === "fulfillment" ? "Ejecucion" : "Aprobacion"}
                      </span>
                      <span className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
                        {group.stepTemplate?.routing === "department"
                          ? "Por departamento"
                          : group.stepTemplate?.routing === "requester_unit"
                            ? "Supervisor del departamento"
                            : group.stepTemplate?.scope ?? group.roleCode}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.items.map((approver, index) => (
                      <div key={approver.id} className="rounded-2xl border border-[#d7e4f2] bg-[#f9fbff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[#001534]">{approver.full_name}</div>
                            <div className="mt-1 text-sm text-[#1e3a5f]">{approver.title}</div>
                            <div className="mt-2 text-sm text-[#1e3a5f]">{approver.email}</div>
                          </div>
                          <span className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#1e3a5f]">
                            {approver.assignment_role === "PRIMARY" ? "Principal" : `Respaldo ${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {approver.assignment_role !== "PRIMARY" ? (
                            <button
                              type="button"
                              onClick={() => updateAssignmentRole(approver.id, "PRIMARY")}
                              className="rounded-full border border-[#8ebdff] bg-[#eef5ff] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0b5ed7] transition hover:bg-[#dfeeff]"
                            >
                              Definir principal
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateAssignmentRole(approver.id, "BACKUP")}
                              disabled={group.items.length === 1}
                              className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Marcar respaldo
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingApproverId(approver.id);
                              setStepCode(approver.role_code);
                              setApproverName(approver.full_name);
                              setApproverEmail(approver.email);
                              setApproverTitle(approver.title);
                              setAssignmentRole(approver.assignment_role === "BACKUP" ? "BACKUP" : "PRIMARY");
                              setApproverMessage(`Editando responsable: ${approver.full_name}`);
                            }}
                            className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => moveApprover(approver.id, "up")}
                            disabled={index === 0}
                            className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            onClick={() => moveApprover(approver.id, "down")}
                            disabled={index === group.items.length - 1}
                            className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Bajar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeApprover(approver.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
              <div className="text-sm font-semibold text-[#001534]">Modo simple de jefatura</div>
              <p className="mt-2 text-sm leading-7 text-[#1e3a5f]">
                SSD ya no necesita que registres colaboradores para resolver la jefatura inmediata. A partir de ahora,
                el sistema toma ese paso desde el <strong className="text-[#001534]">responsable principal</strong> que
                configures para este departamento en el paso <strong className="text-[#001534]">Jefatura inmediata</strong>.
              </p>
              <div className="mt-4 rounded-2xl border border-[#d7e4f2] bg-[#f9fbff] p-4 text-sm leading-7 text-[#1e3a5f]">
                Si el solicitante coincide con ese responsable, SSD saltara automaticamente al siguiente paso del flujo,
                por ejemplo <strong className="text-[#001534]">Gerencia de Area</strong>.
              </div>
            </div>

            {directChildren.length > 0 ? (
              <div className="mt-6 rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
                <div className="text-sm font-semibold text-[#001534]">Subunidades directas</div>
                <div className="mt-4 grid gap-3">
                  {directChildren.map((child) => (
                    <div key={child.id} className="rounded-2xl border border-[#d7e4f2] bg-[#f9fbff] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#001534]">{child.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{getUnitTypeLabel(child.unit_type)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUnitId(child.id);
                            setUnitName(child.name);
                            setUnitType(child.unit_type as (typeof unitTypeOptions)[number]["value"]);
                            setParentId(child.parent_id ?? "");
                            setSortOrder(String(child.sort_order));
                            setMessage(`Editando unidad: ${child.name}`);
                          }}
                          className="rounded-full border border-[#bfd2e7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-[1.3rem] border border-[#d7e4f2] bg-white p-4">
              <div className="text-sm font-semibold text-[#001534]">{editingApproverId ? "Editar responsable" : "Agregar responsable"}</div>
              <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                Selecciona el paso que esta unidad debe atender y registra el principal o sus respaldos.
              </p>

              {availableStepTemplates.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-4 text-sm leading-7 text-[#1e3a5f]">
                  Esta unidad no tiene pasos asignables automaticamente. Revisa el tipo de unidad o los pasos configurados.
                </div>
              ) : (
                <form className="mt-5 space-y-4" onSubmit={handleApproverSubmit}>
                  <select
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7] disabled:cursor-not-allowed disabled:opacity-60"
                    value={stepCode}
                    onChange={(event) => setStepCode(event.target.value)}
                    disabled={Boolean(editingApproverId)}
                    required
                  >
                    <option value="">Selecciona un paso</option>
                    {availableStepTemplates.map((template) => (
                      <option key={template.code} value={template.code}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={approverName}
                    onChange={(event) => setApproverName(event.target.value)}
                    placeholder="Nombre completo"
                    required
                  />
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={approverEmail}
                    onChange={(event) => setApproverEmail(event.target.value)}
                    placeholder="correo@pffsa.com"
                    type="email"
                    required
                  />
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={approverTitle}
                    onChange={(event) => setApproverTitle(event.target.value)}
                    placeholder="Cargo visible"
                    required
                  />
                  <select
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-[#f9fbff] px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={assignmentRole}
                    onChange={(event) => setAssignmentRole(event.target.value as "PRIMARY" | "BACKUP")}
                  >
                    <option value="PRIMARY">Principal</option>
                    <option value="BACKUP">Respaldo</option>
                  </select>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={approverBusy}
                      className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
                    >
                      {approverBusy ? "Guardando..." : editingApproverId ? "Actualizar responsable" : "Agregar responsable"}
                    </button>
                    {(editingApproverId || approverName || approverEmail || approverTitle) ? (
                      <button
                        type="button"
                        onClick={() => resetApproverForm()}
                        className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>
              )}

              {approverMessage ? <p className="mt-4 text-sm text-slate-600">{approverMessage}</p> : null}
            </div>
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </article>
    </section>
  );
}
