const PANAMA_TIME_ZONE = "America/Panama";

export function formatDateTimePanama(value: string | Date, locale = "es-PA") {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PANAMA_TIME_ZONE
  }).format(date);
}

export function formatLongDatePanama(value: string | Date, locale = "es-PA") {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: PANAMA_TIME_ZONE
  }).format(date);
}
