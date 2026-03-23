import { createHash } from "crypto";
import { formatLongDatePanama } from "@/src/shared/lib/datetime";
import { RequestDetail, RequestStep, RequestType } from "@/src/shared/lib/types";

const payloadLabelOverrides: Record<string, string> = {
  colaborador: "Colaborador",
  diasTomados: "Dias tomados",
  fechaInicio: "Fecha de inicio",
  fechaFin: "Fecha de fin",
  tipoAusencia: "Tipo de ausencia"
};

export function getSummaryEntityLabel(requestTypeCode: string) {
  return requestTypeCode === "VACATION_REQUEST" ? "Colaborador" : "Beneficiario";
}

export function humanizeFieldLabel(key: string, requestType?: RequestType) {
  const explicitLabel = requestType?.fields.find((field) => field.name === key)?.label;

  if (explicitLabel) {
    return explicitLabel;
  }

  if (payloadLabelOverrides[key]) {
    return payloadLabelOverrides[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

export function formatPayloadValue(key: string, value: unknown) {
  if (typeof value !== "string") {
    return String(value);
  }

  if (/^fecha/i.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatLongDatePanama(`${value}T00:00:00`);
  }

  return value;
}

export function buildPayloadEntries(request: RequestDetail, requestType?: RequestType) {
  const payload = request.payload as Record<string, unknown>;
  const orderedKeys = [
    ...new Set([
      ...(request.request_type_code === "VACATION_REQUEST"
        ? ["colaborador", "tipoAusencia", "fechaInicio", "fechaFin", "diasTomados"]
        : []),
      ...(requestType?.fields.map((field) => field.name) ?? []),
      ...Object.keys(payload)
    ])
  ];

  return orderedKeys
    .filter((key) => key in payload)
    .map((key) => ({
      key,
      label: humanizeFieldLabel(key, requestType),
      value: payload[key]
    }));
}

export function getStepDigitalSignature(step: RequestStep) {
  const metadata = step.metadata as Record<string, unknown>;
  const signature = metadata.digitalSignature as Record<string, unknown> | undefined;
  const legacySeed = `${step.id}|${step.approver_email}|${step.decision ?? step.status}|${step.acted_at ?? ""}`;
  const legacyDigest = createHash("sha256").update(legacySeed).digest("hex").toUpperCase();

  if (signature) {
    return {
      signatureId: String(signature.signatureId ?? `SSD-LEGACY-${legacyDigest.slice(0, 16)}`),
      signerName: String(signature.signerName ?? step.approver_name),
      signerEmail: String(signature.signerEmail ?? step.approver_email),
      decision: String(signature.decision ?? step.decision ?? step.status),
      signedAt: String(signature.signedAt ?? step.acted_at ?? ""),
      provider: String(signature.provider ?? "SSD_CORPORATE_SESSION"),
      algorithm: String(signature.algorithm ?? "SHA-256"),
      digest: String(signature.digest ?? legacyDigest)
    };
  }

  if (!step.acted_at || !["approved", "completed", "rejected"].includes(step.status)) {
    return null;
  }

  return {
    signatureId: `SSD-LEGACY-${legacyDigest.slice(0, 16)}`,
    signerName: step.approver_name,
    signerEmail: step.approver_email,
    decision: String(step.decision ?? step.status),
    signedAt: step.acted_at,
    provider: "SSD_LEGACY_HASH_BACKFILL",
    algorithm: "SHA-256",
    digest: legacyDigest
  };
}
