export type PayloadDisplayValue = {
  text?: string;
  list?: string[];
};

function parseIsoDateParts(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function formatIsoDateField(value: string) {
  const parts = parseIsoDateParts(value);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "long",
    timeZone: "America/Panama"
  }).format(date);
}

export function humanizePayloadLabel(key: string) {
  const aliases: Record<string, string> = {
    tipoSolicitud: "Tipo de solicitud",
    fechaNecesaria: "Fecha requerida",
    salarioReferencial: "Salario referencial",
    justificacionRol: "Justificacion del rol",
    tipoAusencia: "Tipo de ausencia",
    fechaInicio: "Fecha de inicio",
    fechaFin: "Fecha de fin",
    fechaSalida: "Fecha de salida",
    tipoSalida: "Tipo de salida",
    proveedorSugerido: "Proveedor sugerido",
    montoEstimado: "Monto estimado",
    detalleCompra: "Detalle de compra",
    tipoActivo: "Tipo de activo",
    beneficiario: "Beneficiario(s)",
    beneficiarios: "Beneficiario(s)",
    beneficiarioActivo: "Beneficiario(s) final(es)",
    presupuestoEstimado: "Presupuesto estimado",
    planSugerido: "Plan sugerido",
    motivoNegocio: "Motivo del requerimiento",
    requiereEquipo: "Entrega de equipo",
    diasTomados: "Dias tomados",
    colaborador: "Colaborador"
  };

  if (aliases[key]) {
    return aliases[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}

function formatSimpleValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function formatPayloadValue(key: string, value: unknown): PayloadDisplayValue {
  if (Array.isArray(value)) {
    const values = value.map((item) => formatSimpleValue(item)).filter((item) => item !== "N/A");
    if (values.length > 1) {
      return { list: values };
    }
    return { text: values[0] ?? "N/A" };
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return { text: "N/A" };
    }

    const dateLabel = formatIsoDateField(normalized);
    if (dateLabel) {
      return { text: dateLabel };
    }

    const keySuggestsList = /benefici|colaborador|lista|participante/i.test(key);
    if (keySuggestsList) {
      const values = normalized
        .split(/\r?\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (values.length > 1) {
        return { list: values };
      }

      if (values.length === 1) {
        return { text: values[0] };
      }
    }

    return { text: normalized };
  }

  return { text: formatSimpleValue(value) };
}

export function summarizePayloadValue(display: PayloadDisplayValue, maxListItems = 2) {
  if (display.list?.length) {
    const visible = display.list.slice(0, maxListItems);
    const hidden = display.list.length - visible.length;
    return hidden > 0 ? `${visible.join(", ")} +${hidden}` : visible.join(", ");
  }

  return display.text ?? "N/A";
}

export function buildPayloadHighlights(payload: Record<string, unknown>, maxFields = 2) {
  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, maxFields)
    .map(([key, value]) => ({
      key,
      label: humanizePayloadLabel(key),
      display: formatPayloadValue(key, value)
    }));
}
