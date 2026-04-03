import { RequestType, WorkflowStepTemplate } from "@/src/lib/types";

export function routingLabel(step: Pick<WorkflowStepTemplate, "routing" | "scope">) {
  return step.routing === "department" ? "Por departamento" : step.scope ?? "Scope";
}

export function buildRouteCount(departments: string[], stepTemplates: WorkflowStepTemplate[]) {
  const departmentSteps = stepTemplates.filter((step) => step.routing === "department").length;
  const scopeSteps = stepTemplates.filter((step) => step.routing === "scope").length;
  return departmentSteps * departments.length + scopeSteps;
}

export function stepUsageCount(stepCode: string, requestTypes: RequestType[]) {
  return requestTypes.filter((requestType) => requestType.workflow.steps.some((step) => step.code === stepCode)).length;
}
