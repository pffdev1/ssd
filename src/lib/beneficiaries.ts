export function parseBeneficiaries(payload: Record<string, unknown>) {
  return [payload.beneficiarios, payload.beneficiario, payload.beneficiarioActivo, payload.colaborador]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\r?\n|,|;/))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function stringifyBeneficiaries(payload: Record<string, unknown>) {
  return parseBeneficiaries(payload).join(", ");
}
