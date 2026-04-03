import type { WorkflowStepTemplate } from "./types";

export const REQUESTER_MANAGER_VIRTUAL_STEP_CODE = "__REQUESTER_MANAGER__";

const MANAGER_STEP_CODE_CANDIDATES = [
  "IMMEDIATE_LEAD",
  "DIRECT_MANAGER",
  "DIRECT_MANAGER_APPRV",
  "DIRECT_LEAD",
  "DIRECT_LEAD_APPRV",
  "MANAGER_APPROVAL",
  "JEFE_INMEDIATO",
  "JEFE_DIRECTO",
  "SUPERVISOR_DIRECTO"
];

const MANAGER_STEP_SCOPE_CANDIDATES = [
  "REQUESTER_MANAGER",
  "DIRECT_MANAGER",
  "IMMEDIATE_LEAD"
];

type WorkflowStepLike = {
  code: string;
  label?: string | null;
  scope?: string | null;
};

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]/g, "_")
    .toUpperCase();
}

function matchesManagerLabel(label: string | null | undefined) {
  if (!label) {
    return false;
  }

  const normalizedLabel = normalizeToken(label);
  const mentionsManager =
    normalizedLabel.includes("JEFE") ||
    normalizedLabel.includes("JEFATURA") ||
    normalizedLabel.includes("MANAGER") ||
    normalizedLabel.includes("SUPERVISOR");
  const mentionsDirect =
    normalizedLabel.includes("DIRECT") || normalizedLabel.includes("INMEDIAT");

  return mentionsManager && mentionsDirect;
}

export function isManagerWorkflowStepCode(code: string | null | undefined) {
  if (!code) {
    return false;
  }

  const normalizedCode = normalizeToken(code);

  if (MANAGER_STEP_CODE_CANDIDATES.includes(normalizedCode)) {
    return true;
  }

  if (normalizedCode.includes("JEFE")) {
    return true;
  }

  if (normalizedCode.includes("MANAGER") && normalizedCode.includes("DIRECT")) {
    return true;
  }

  if (normalizedCode.includes("SUPERVISOR") && normalizedCode.includes("DIRECT")) {
    return true;
  }

  return false;
}

export function isManagerWorkflowStep(step: WorkflowStepLike | null | undefined) {
  if (!step) {
    return false;
  }

  const normalizedScope = step.scope ? normalizeToken(step.scope) : null;
  if (normalizedScope && MANAGER_STEP_SCOPE_CANDIDATES.includes(normalizedScope)) {
    return true;
  }

  if (isManagerWorkflowStepCode(step.code)) {
    return true;
  }

  return matchesManagerLabel(step.label);
}

export function getAdditionalWorkflowCodes(stepCodes: string[]) {
  const seen = new Set<string>();
  const filtered: string[] = [];

  for (const rawCode of stepCodes) {
    const code = rawCode.trim();

    if (!code || isManagerWorkflowStepCode(code) || seen.has(code)) {
      continue;
    }

    seen.add(code);
    filtered.push(code);
  }

  return filtered;
}

export function getAdditionalWorkflowSteps<T extends WorkflowStepLike>(steps: T[]) {
  return steps.filter((step) => !isManagerWorkflowStep(step));
}

export function resolveManagerWorkflowStepCode(
  templates: WorkflowStepTemplate[]
) {
  const activeTemplates = templates.filter((template) => template.active);
  const inactiveTemplates = templates.filter((template) => !template.active);
  const candidates: WorkflowStepLike[] = [...activeTemplates, ...inactiveTemplates];

  for (const candidateScope of MANAGER_STEP_SCOPE_CANDIDATES) {
    const scopeMatch = candidates.find((step) => step.scope && normalizeToken(step.scope) === candidateScope);
    if (scopeMatch) {
      return scopeMatch.code;
    }
  }

  for (const candidate of MANAGER_STEP_CODE_CANDIDATES) {
    const matched = candidates.find((step) => normalizeToken(step.code) === candidate);
    if (matched) {
      return matched.code;
    }
  }

  const heuristicMatch = candidates.find((step) => isManagerWorkflowStepCode(step.code));
  if (heuristicMatch) {
    return heuristicMatch.code;
  }

  const labelMatch = candidates.find((step) => matchesManagerLabel(step.label));

  if (labelMatch) {
    return labelMatch.code;
  }

  return null;
}

export function buildWorkflowCodesToPersist(
  additionalStepCodes: string[],
  managerStepCode: string | null
) {
  const cleanedAdditionalStepCodes = getAdditionalWorkflowCodes(additionalStepCodes);

  if (cleanedAdditionalStepCodes.length > 0) {
    return {
      stepCodes: cleanedAdditionalStepCodes,
      managerOnlyMode: false
    };
  }

  if (managerStepCode) {
    return {
      stepCodes: [managerStepCode],
      managerOnlyMode: true
    };
  }

  return {
    stepCodes: [],
    managerOnlyMode: true
  };
}
