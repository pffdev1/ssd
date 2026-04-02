export const statusLabels: Record<string, string> = {
  pending_area_approval: "Pendiente Area",
  pending_general_management: "Pendiente GG",
  pending_hr: "Pendiente RRHH",
  pending_finance: "Pendiente Finanzas",
  pending_it: "Pendiente TI",
  in_fulfillment: "En ejecucion",
  approved: "Aprobada",
  completed: "Completada",
  rejected: "Rechazada",
  pending_review: "Pendiente revision",
  pending: "Pendiente",
  queued: "En cola"
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}
