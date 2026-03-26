"use client";

import { ApproverAssignment, RequestType, WorkflowStepTemplate } from "@/src/shared/lib/types";

export type AdminSectionId = "overview" | "steps" | "workflows" | "catalogs" | "admins" | "mobile";

export type ApprovalRouteBlueprint = {
  key: string;
  heading: string;
  roleCode: string;
  roleLabel: string;
  scope: string;
  department: string | null;
  summary: string;
};

export const adminSections: Array<{
  id: AdminSectionId;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Resumen",
    description: "Vista general del modelo"
  },
  {
    id: "steps",
    label: "Pasos",
    description: "Catalogo reusable"
  },
  {
    id: "workflows",
    label: "Workflows",
    description: "Secuencia por solicitud"
  },
  {
    id: "catalogs",
    label: "Catalogos",
    description: "Parametros del sistema"
  },
  {
    id: "admins",
    label: "Administradores",
    description: "Acceso total"
  },
  {
    id: "mobile",
    label: "Lineas aprobadas",
    description: "Cartas responsivas"
  }
];

export function getApproverGroupKey(item: Pick<ApproverAssignment, "department" | "role_code" | "scope">) {
  return `${item.department ?? item.scope}::${item.role_code}`;
}

export function getRouteKey(route: Pick<ApprovalRouteBlueprint, "department" | "roleCode" | "scope">) {
  return `${route.department ?? route.scope}::${route.roleCode}`;
}

export function buildApprovalRoutes(departments: string[], stepTemplates: WorkflowStepTemplate[]) {
  const orderedTemplates = [...stepTemplates].sort(
    (left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label)
  );

  const departmentRoutes: ApprovalRouteBlueprint[] = orderedTemplates
    .filter((template) => template.routing === "department")
    .flatMap((template) =>
      departments.map((department) => ({
        key: getRouteKey({
          department,
          roleCode: template.code,
          scope: template.scope ?? "AREA"
        }),
        heading: `${department} - ${template.label}`,
        roleCode: template.code,
        roleLabel: template.label,
        scope: template.scope ?? "AREA",
        department,
        summary: template.description
      }))
    );

  const scopeRoutes: ApprovalRouteBlueprint[] = orderedTemplates
    .filter((template) => template.routing === "scope")
    .map((template) => ({
      key: getRouteKey({
        department: null,
        roleCode: template.code,
        scope: template.scope ?? template.code
      }),
      heading: template.label,
      roleCode: template.code,
      roleLabel: template.label,
      scope: template.scope ?? template.code,
      department: null,
      summary: template.description
    }));

  return [...departmentRoutes, ...scopeRoutes];
}

export function getApproverGroupHeading(
  item: Pick<ApproverAssignment, "department" | "role_code" | "scope">,
  stepTemplates: WorkflowStepTemplate[]
) {
  const roleLabel = stepTemplates.find((template) => template.code === item.role_code)?.label ?? item.role_code;
  return item.department ? `${item.department} - ${roleLabel}` : `${roleLabel} - ${item.scope}`;
}

function routeParticipatesInStep(route: ApprovalRouteBlueprint, requestType: RequestType) {
  return requestType.workflow.steps.find((step) => {
    if (step.code !== route.roleCode) {
      return false;
    }

    if (route.department) {
      return step.routing === "department";
    }

    if (step.routing !== "scope") {
      return false;
    }

    return (step.scope ?? route.scope) === route.scope;
  });
}

export function getRequestTypesForRoute(route: ApprovalRouteBlueprint, requestTypes: RequestType[]) {
  return requestTypes
    .map((requestType) => {
      const matchedStep = routeParticipatesInStep(route, requestType);

      if (!matchedStep) {
        return null;
      }

      return {
        requestType,
        step: matchedStep
      };
    })
    .filter(Boolean) as Array<{
    requestType: RequestType;
    step: RequestType["workflow"]["steps"][number];
  }>;
}
