import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { query } from "../db";
import { env } from "../config/env";
import RequestNotificationEmail, {
  RequestNotificationEmailProps,
  RequestNotificationLink,
  RequestNotificationRow,
  RequestNotificationSignature,
  RequestNotificationTone
} from "../emails/templates/RequestNotificationEmail";
import { AdminUserRecord, RequestDetailRecord, RequestStepRecord } from "../types/domain";

const PANAMA_LOCALE = "es-PA";
const PANAMA_TIMEZONE = "America/Panama";
const EMAIL_LOGO_CID = "pedersen-connect-logo@ssd";
const EMAIL_LOGO_PATH = resolve(process.cwd(), "assets", "brand", "pedersen-connect-logo.png");

type NotificationTask = {
  name: string;
  run: () => Promise<unknown>;
};

type EmailTone = "info" | "action" | "success" | "danger" | "admin";

let cachedTransporter: nodemailer.Transporter | null | undefined;
let smtpMissingLogged = false;

function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function logNotification(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger(`[notifications] ${message}${suffix}`);
}

function getTransporter() {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  if (!hasSmtpConfig()) {
    if (!smtpMissingLogged) {
      logNotification("warn", "SMTP deshabilitado por configuracion incompleta");
      smtpMissingLogged = true;
    }

    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  return cachedTransporter;
}

function getEmailAttachments() {
  if (!existsSync(EMAIL_LOGO_PATH)) {
    return [];
  }

  return [
    {
      filename: "pedersen-connect-logo.png",
      path: EMAIL_LOGO_PATH,
      cid: EMAIL_LOGO_CID,
      contentType: "image/png",
      contentDisposition: "inline" as const
    }
  ];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Pendiente";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(PANAMA_LOCALE, {
    timeZone: PANAMA_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function translateStatus(status: string) {
  switch (status) {
    case "pending_area_approval":
      return "Pendiente de gerencia de area";
    case "pending_general_management":
      return "Pendiente de gerencia general";
    case "pending_hr":
      return "Pendiente de RRHH";
    case "pending_finance":
      return "Pendiente de revision presupuestaria";
    case "pending_it":
      return "Pendiente de TI";
    case "pending_review":
      return "Pendiente de revision";
    case "in_fulfillment":
      return "En ejecucion";
    case "approved":
      return "Aprobada";
    case "completed":
      return "Completada";
    case "rejected":
      return "Rechazada";
    case "pending":
      return "Pendiente";
    case "queued":
      return "En cola";
    default:
      return status;
  }
}

function translateDecision(decision?: string | null, status?: string) {
  switch (decision) {
    case "approve":
      return "Aprobada";
    case "reject":
      return "Rechazada";
    case "complete":
      return "Completada";
    default:
      return status ? translateStatus(status) : "Actualizada";
  }
}

function getStatusPresentation(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("rechaz")) {
    return {
      accent: "#b42318",
      background: "#fff1f1",
      border: "#fecaca",
      pillBackground: "#b42318",
      title: "Estado actual"
    };
  }

  if (normalized.includes("aprob") || normalized.includes("complet")) {
    return {
      accent: "#067647",
      background: "#edfdf3",
      border: "#b7ebc6",
      pillBackground: "#067647",
      title: "Estado actual"
    };
  }

  if (normalized.includes("pend")) {
    return {
      accent: "#1d4ed8",
      background: "#eef4ff",
      border: "#bfdbfe",
      pillBackground: "#1d4ed8",
      title: "Estado actual"
    };
  }

  return {
    accent: "#1e3a5f",
    background: "#f8fbff",
    border: "#d7e4f2",
    pillBackground: "#1e3a5f",
    title: "Estado actual"
  };
}

function getEmailTonePalette(tone: EmailTone) {
  switch (tone) {
    case "action":
      return {
        eyebrow: "Accion pendiente",
        gradientFrom: "#eef4ff",
        gradientTo: "#dfeeff",
        panelBackground: "#f7fbff",
        panelBorder: "#bfd2e7",
        badgeBackground: "#0b5ed7",
        badgeText: "#ffffff",
        buttonBackground: "#0b5ed7",
        buttonBorder: "#0b5ed7"
      };
    case "success":
      return {
        eyebrow: "Proceso completado",
        gradientFrom: "#edfdf3",
        gradientTo: "#dff7e8",
        panelBackground: "#f7fff9",
        panelBorder: "#b7ebc6",
        badgeBackground: "#067647",
        badgeText: "#ffffff",
        buttonBackground: "#067647",
        buttonBorder: "#067647"
      };
    case "danger":
      return {
        eyebrow: "Atencion",
        gradientFrom: "#fff4f3",
        gradientTo: "#ffe3e0",
        panelBackground: "#fff8f8",
        panelBorder: "#fecaca",
        badgeBackground: "#b42318",
        badgeText: "#ffffff",
        buttonBackground: "#b42318",
        buttonBorder: "#b42318"
      };
    case "admin":
      return {
        eyebrow: "Gestion administrativa",
        gradientFrom: "#f3f0ff",
        gradientTo: "#e8e0ff",
        panelBackground: "#fbfaff",
        panelBorder: "#d9ccff",
        badgeBackground: "#6941c6",
        badgeText: "#ffffff",
        buttonBackground: "#6941c6",
        buttonBorder: "#6941c6"
      };
    case "info":
    default:
      return {
        eyebrow: "Comunicacion SSD",
        gradientFrom: "#f8fbff",
        gradientTo: "#eef5fc",
        panelBackground: "#ffffff",
        panelBorder: "#d7e4f2",
        badgeBackground: "#1f406b",
        badgeText: "#ffffff",
        buttonBackground: "#1f406b",
        buttonBorder: "#1f406b"
      };
  }
}

function renderStatusBanner(input: {
  label: string;
  detail?: string;
}) {
  const palette = getStatusPresentation(input.label);

  return `
    <div style="margin:18px 0;padding:16px 18px;border:1px solid ${palette.border};background:${palette.background};border-radius:18px">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${palette.accent};font-weight:700">${palette.title}</div>
        <span style="display:inline-block;background:${palette.pillBackground};color:#ffffff;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">
          ${escapeHtml(input.label)}
        </span>
      </div>
      ${
        input.detail
          ? `<div style="margin-top:10px;color:#0f172a;font-size:14px;line-height:1.7">${escapeHtml(input.detail)}</div>`
          : ""
      }
    </div>
  `;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (Array.isArray(value)) {
    const values = value.map((item) => formatValue(item)).filter((item) => item !== "N/A");
    return values.length > 0 ? values.join(", ") : "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const preferredKey = ["nombre", "name", "label", "fullName"].find((key) => typeof objectValue[key] === "string");

    if (preferredKey) {
      return String(objectValue[preferredKey]);
    }

    return JSON.stringify(objectValue);
  }

  return String(value);
}

function formatHtmlValue(value: unknown) {
  return escapeHtml(formatValue(value));
}

async function renderNotificationTemplate(props: RequestNotificationEmailProps) {
  return render(
    React.createElement(RequestNotificationEmail, {
      brandLogoSrc: existsSync(EMAIL_LOGO_PATH) ? `cid:${EMAIL_LOGO_CID}` : `${env.appBaseUrl}/brand/pedersen-connect-logo.png`,
      brandLogoAlt: "Pedersen Connect",
      ...props
    })
  );
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  tag: string;
  request: RequestDetailRecord;
}) {
  const transporter = getTransporter();

  if (!transporter) {
    return false;
  }

  const recipients = input.to
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    logNotification("warn", "Correo omitido por no tener destinatarios", {
      tag: input.tag,
      requestId: input.request.id,
      ticket: input.request.ticket_code
    });
    return false;
  }

  const info = (await transporter.sendMail({
    from: env.smtpFrom,
    to: recipients.join(", "),
    subject: input.subject,
    html: input.html,
    attachments: getEmailAttachments()
  })) as { messageId?: string };

  logNotification("info", "Correo enviado", {
    tag: input.tag,
    requestId: input.request.id,
    ticket: input.request.ticket_code,
    recipients,
    messageId: info.messageId
  });

  return true;
}

function buildTeamsFacts(request: RequestDetailRecord, extraLines: string[]) {
  return [
    `Ticket: ${request.ticket_code}`,
    `Tipo: ${request.request_type_name}`,
    `Solicitante: ${request.requester_name} (${request.requester_email})`,
    `Departamento: ${request.department}`,
    `Estado: ${translateStatus(request.status)}`,
    ...extraLines
  ].join("\n");
}

const payloadLabelOverrides: Record<string, string> = {
  colaborador: "Colaborador",
  diasTomados: "Dias tomados",
  fechaInicio: "Fecha de inicio",
  fechaFin: "Fecha de fin",
  tipoAusencia: "Tipo de ausencia"
};

function getEntityLabel(request: RequestDetailRecord) {
  return request.request_type_code === "VACATION_REQUEST" ? "Colaborador" : "Beneficiario(s)";
}

function humanizePayloadLabel(key: string) {
  if (payloadLabelOverrides[key]) {
    return payloadLabelOverrides[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

function collectRawValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRawValues(item));
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const preferredKey = ["nombre", "name", "label", "fullName"].find((key) => objectValue[key] !== undefined);

    return preferredKey ? collectRawValues(objectValue[preferredKey]) : [];
  }

  return [String(value)];
}

function parseBeneficiaries(request: RequestDetailRecord) {
  const payload = request.payload as Record<string, unknown>;
  const rawValues = [payload.beneficiarios, payload.beneficiario, payload.colaborador, request.beneficiary_name].flatMap((value) =>
    collectRawValues(value)
  );

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => value.split(/\r?\n|,|;/))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function buildPayloadRows(request: RequestDetailRecord) {
  return Object.entries(request.payload)
    .map(([key, value]) => ({
      label: humanizePayloadLabel(key),
      value: formatValue(value)
    }))
    .filter((row) => row.value !== "N/A");
}

function buildRequestSummaryRows(request: RequestDetailRecord, step?: RequestStepRecord, extraRows: Array<[string, string]> = []): RequestNotificationRow[] {
  const beneficiaries = parseBeneficiaries(request);
  const rows: RequestNotificationRow[] = [
    { label: "Ticket", value: request.ticket_code },
    { label: "Tipo", value: request.request_type_name },
    { label: "Solicitante", value: `${request.requester_name} (${request.requester_email})` },
    { label: "Departamento", value: request.department },
    { label: "Asunto", value: request.subject },
    { label: "Justificacion", value: request.justification }
  ];

  if (step) {
    rows.splice(4, 0, {
      label: "Paso",
      value: step.label
    });
  }

  if (beneficiaries.length > 0) {
    rows.push({
      label: getEntityLabel(request),
      value: beneficiaries.join(", ")
    });
  }

  rows.push(...extraRows.map(([label, value]) => ({ label, value })));

  return rows;
}

function buildSignatureData(step: RequestStepRecord): RequestNotificationSignature | undefined {
  const signature = (step.metadata as Record<string, unknown>).digitalSignature as Record<string, unknown> | undefined;

  if (!signature) {
    return undefined;
  }

  return {
    signatureId: String(signature.signatureId ?? "N/A"),
    signerName: String(signature.signerName ?? step.approver_name),
    signedAt: formatDateTime(String(signature.signedAt ?? step.acted_at ?? ""))
  };
}

function buildResponsivaLinks(request: RequestDetailRecord): RequestNotificationLink[] {
  return parseBeneficiaries(request).map((beneficiary) => ({
    label: beneficiary,
    href: responsivaUrl(request, beneficiary)
  }));
}

async function sendTeamsMessage(title: string, extraLines: string[], request: RequestDetailRecord) {
  if (!env.teamsWebhookUrl) {
    return false;
  }

  const response = await fetch(env.teamsWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      themeColor: "1F4F73",
      summary: title,
      sections: [
        {
          activityTitle: `${env.teamsChannelLabel} | ${title}`,
          activitySubtitle: request.subject,
          text: buildTeamsFacts(request, extraLines)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Teams devolvio ${response.status}`);
  }

  return true;
}

function findPendingStep(request: RequestDetailRecord) {
  return request.steps.find((step) => step.status === "pending");
}

function findLastActedStep(request: RequestDetailRecord) {
  return [...request.steps]
    .filter((step) => Boolean(step.acted_at))
    .sort((left, right) => new Date(right.acted_at ?? 0).getTime() - new Date(left.acted_at ?? 0).getTime())[0];
}

function requestUrl(request: RequestDetailRecord) {
  return `${env.appBaseUrl}/requests/${request.id}`;
}

function inboxUrl() {
  return `${env.appBaseUrl}/inbox`;
}

function responsivaUrl(request: RequestDetailRecord, beneficiary: string) {
  return `${env.appBaseUrl}/requests/${request.id}/responsiva?beneficiary=${encodeURIComponent(beneficiary)}`;
}

function renderEmailBrandHeader() {
  const logoMarkup = existsSync(EMAIL_LOGO_PATH)
    ? `<img src="cid:${EMAIL_LOGO_CID}" alt="Pedersen Connect" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:contain;border:0" />`
    : `<div style="width:64px;height:64px;line-height:64px;text-align:center;font-size:20px;font-weight:700;color:#1e3a5f">PC</div>`;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td valign="top" style="width:88px;padding-right:16px">
          <div style="width:72px;height:72px;border-radius:20px;border:1px solid #d7e4f2;background:#ffffff;padding:4px;box-sizing:border-box">
            ${logoMarkup}
          </div>
        </td>
        <td valign="top" style="padding-right:16px">
          <div style="font-size:11px;letter-spacing:0.26em;text-transform:uppercase;color:#1f406b;font-weight:700">Pedersen Connect</div>
          <div style="margin-top:6px;font-size:24px;line-height:1.2;color:#001534;font-weight:700">Sistema de Solicitudes Digital</div>
          <div style="margin-top:8px;font-size:13px;line-height:1.6;color:#46607d">Pedersen Fine Foods | Departamento de Tecnologia e Innovacion</div>
        </td>
        <td valign="top" align="right" style="width:220px">
          <div style="display:inline-block;padding:14px 16px;border:1px solid #bfd2e7;border-radius:20px;background:#f5faff;text-align:left">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#1f406b;font-weight:700">Comunicacion oficial</div>
            <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#1e3a5f">Flujo documental corporativo SSD</div>
          </div>
        </td>
      </tr>
    </table>
  `;
}

function renderEmailShell(input: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  actionLabel?: string;
  actionUrl?: string;
  tone?: EmailTone;
  categoryLabel?: string;
}) {
  const palette = getEmailTonePalette(input.tone ?? "info");

  return `
    <div style="margin:0;padding:24px 12px;background:#f3f7fc;color:#0f172a;font-family:Segoe UI,Arial,sans-serif">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;border-collapse:collapse;background:#ffffff;border:1px solid #bfd2e7;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.08)">
              <tr>
                <td style="padding:28px 28px 24px;background:linear-gradient(180deg,${palette.gradientFrom} 0%,${palette.gradientTo} 100%);border-bottom:1px solid ${palette.panelBorder}">
                  ${renderEmailBrandHeader()}
                  <div style="margin-top:22px;padding:20px 22px;border:1px solid ${palette.panelBorder};border-radius:24px;background:${palette.panelBackground}">
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
                      <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#1f406b;font-weight:700">${palette.eyebrow}</div>
                      ${
                        input.categoryLabel
                          ? `<span style="display:inline-block;background:${palette.badgeBackground};color:${palette.badgeText};padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${escapeHtml(input.categoryLabel)}</span>`
                          : ""
                      }
                    </div>
                    <h2 style="margin:10px 0 0;font-size:28px;line-height:1.18;color:#001534;font-weight:700">${escapeHtml(input.title)}</h2>
                    ${
                      input.subtitle
                        ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#1e3a5f">${escapeHtml(input.subtitle)}</p>`
                        : ""
                    }
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;color:#1e3a5f;background:#ffffff">
                  ${input.bodyHtml}
                  ${
                    input.actionLabel && input.actionUrl
                      ? `<div style="margin-top:24px">
                          <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:${palette.buttonBackground};color:#ffffff !important;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700;border:1px solid ${palette.buttonBorder}">
                            ${escapeHtml(input.actionLabel)}
                          </a>
                        </div>`
                      : ""
                  }
                </td>
              </tr>
              <tr>
                <td style="padding:16px 28px;border-top:1px solid #d7e4f2;background:#f9fbff;font-size:12px;line-height:1.7;color:#46607d">
                  Pedersen Fine Foods | Departamento de Tecnologia e Innovacion | Mensaje generado automaticamente por SSD
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderExecutiveSummary(input: {
  heading: string;
  items: Array<{ label: string; value: string }>;
}) {
  return `
    <div style="margin:18px 0;padding:18px;border:1px solid #d7e4f2;background:#f9fbff;border-radius:18px">
      <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#1f406b;font-weight:700">${escapeHtml(input.heading)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border-collapse:collapse">
        ${input.items
          .map(
            (item) => `
              <tr>
                <td style="padding:6px 0;width:180px;font-size:13px;color:#46607d;font-weight:600">${escapeHtml(item.label)}</td>
                <td style="padding:6px 0;font-size:14px;color:#001534">${escapeHtml(item.value)}</td>
              </tr>
            `
          )
          .join("")}
      </table>
    </div>
  `;
}

function buildRequestSummaryTable(request: RequestDetailRecord, step?: RequestStepRecord, extraRows: Array<[string, string]> = []) {
  const beneficiaries = parseBeneficiaries(request);
  const rows: Array<[string, string]> = [
    ["Ticket", request.ticket_code],
    ["Tipo", request.request_type_name],
    ["Solicitante", `${request.requester_name} (${request.requester_email})`],
    ["Departamento", request.department],
    ["Asunto", request.subject],
    ["Justificacion", request.justification]
  ];

  if (step) {
    rows.splice(4, 0, ["Paso", step.label]);
  }

  if (beneficiaries.length > 0) {
    rows.push([getEntityLabel(request), beneficiaries.join(", ")]);
  }

  rows.push(...extraRows);

  return `
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      ${rows
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:10px;border:1px solid #d7e4f2;background:#f8fbff;font-weight:600;color:#001534">${escapeHtml(label)}</td>
              <td style="padding:10px;border:1px solid #d7e4f2;color:#1e3a5f">${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("")}
    </table>
  `;
}

function renderSignatureBlock(step: RequestStepRecord) {
  const signature = (step.metadata as Record<string, unknown>).digitalSignature as Record<string, unknown> | undefined;

  if (!signature) {
    return "";
  }

  return `
    <div style="margin-top:18px;padding:16px;border:1px solid #d7e4f2;background:#f8fbff;border-radius:16px">
      <div style="font-weight:700;color:#001534;margin-bottom:8px">Firma digital SSD</div>
      <div style="font-size:14px;color:#1e3a5f;line-height:1.7">
        <div><strong>Codigo:</strong> ${escapeHtml(String(signature.signatureId ?? "N/A"))}</div>
        <div><strong>Firmante:</strong> ${escapeHtml(String(signature.signerName ?? step.approver_name))}</div>
        <div><strong>Fecha y hora:</strong> ${escapeHtml(formatDateTime(String(signature.signedAt ?? step.acted_at ?? "")))}</div>
      </div>
    </div>
  `;
}

async function getAdminRecipients() {
  const result = await query<AdminUserRecord>(
    `select *
     from admin_users
     order by full_name asc, email asc`
  );

  return Array.from(new Set(result.rows.map((row) => row.email.trim().toLowerCase()).filter(Boolean)));
}

function isMobileLineApprovedByGg(request: RequestDetailRecord, actedStep?: RequestStepRecord) {
  return Boolean(
    actedStep &&
      request.request_type_code === "MOBILE_LINE_REQUEST" &&
      actedStep.role_code === "GG_APPROVAL" &&
      actedStep.decision === "approve"
  );
}

async function notifyRequesterCreated(request: RequestDetailRecord) {
  const pendingStep = findPendingStep(request);

  return sendEmail({
    to: request.requester_email,
    subject: `SSD | Solicitud registrada ${request.ticket_code}`,
    tag: "requester_created",
    request,
    html: await renderNotificationTemplate({
      previewText: `Solicitud registrada ${request.ticket_code}`,
      tone: "info",
      categoryLabel: "Registro",
      title: "Solicitud registrada",
      subtitle: "Tu solicitud ya fue recibida por el Sistema de Solicitudes Digital.",
      greetingName: request.requester_name,
      introText: "Tu solicitud fue registrada correctamente y ya entro al flujo de aprobacion corporativo.",
      statusLabel: translateStatus(request.status),
      statusDetail: "SSD registro tu solicitud y la envio al primer responsable disponible.",
      summaryHeading: "Registro inicial",
      summaryRows: [
        { label: "Ticket", value: request.ticket_code },
        { label: "Tipo", value: request.request_type_name },
        { label: "Departamento", value: request.department },
        { label: "Primer responsable", value: pendingStep ? `${pendingStep.approver_name} (${pendingStep.label})` : "Pendiente de configuracion" }
      ],
      detailHeading: "Resumen de la solicitud",
      detailRows: buildRequestSummaryRows(request),
      actionLabel: "Ver solicitud",
      actionUrl: requestUrl(request)
    })
  });
}

async function notifyApprover(request: RequestDetailRecord, step: RequestStepRecord) {
  const existingNotification = await query<{ total: string }>(
    `select count(*)::text as total
     from request_events
     where request_id = $1
       and event_type = 'STEP_PENDING_NOTIFIED'
       and coalesce(payload ->> 'stepId', '') = $2`,
    [request.id, step.id]
  );

  if (Number(existingNotification.rows[0]?.total ?? "0") > 0) {
    logNotification("info", "Correo pendiente omitido por deduplicacion de paso", {
      tag: "approver_pending",
      requestId: request.id,
      ticket: request.ticket_code,
      stepId: step.id,
      recipient: step.approver_email
    });
    return false;
  }

  const actionLabel = step.kind === "approval" ? "aprobar" : "ejecutar";

  const sent = await sendEmail({
    to: step.approver_email,
    subject: `SSD | Accion requerida ${request.ticket_code}`,
    tag: "approver_pending",
    request,
    html: await renderNotificationTemplate({
      previewText: `Accion requerida ${request.ticket_code}`,
      tone: "action",
      categoryLabel: step.kind === "approval" ? "Aprobacion" : "Ejecucion",
      title: "Accion requerida en SSD",
      subtitle: `Tienes una solicitud pendiente por ${actionLabel}.`,
      greetingName: step.approver_name,
      introText: `Se te asigno una solicitud en el paso ${step.label}.`,
      statusLabel: "Pendiente de accion",
      statusDetail: `${step.label} requiere tu ${step.kind === "approval" ? "aprobacion" : "ejecucion"} en SSD.`,
      summaryHeading: "Tu intervencion",
      summaryRows: [
        { label: "Paso asignado", value: step.label },
        { label: "Solicitante", value: request.requester_name },
        { label: "Departamento", value: request.department },
        { label: "Tipo de accion", value: step.kind === "approval" ? "Aprobacion requerida" : "Ejecucion requerida" }
      ],
      detailHeading: "Resumen de la solicitud",
      detailRows: buildRequestSummaryRows(request, step),
      formHeading: "Resumen del formulario",
      formRows: buildPayloadRows(request),
      actionLabel: "Abrir bandeja",
      actionUrl: inboxUrl()
    })
  });

  if (sent) {
    await query(
      `insert into request_events (
        request_id,
        event_type,
        actor_name,
        actor_email,
        notes,
        payload
      ) values ($1, 'STEP_PENDING_NOTIFIED', 'SSD Notifications', 'noreply@ssd.local', $2, $3::jsonb)`,
      [
        request.id,
        `Notificacion de paso pendiente enviada a ${step.approver_email}`,
        JSON.stringify({
          stepId: step.id,
          approverEmail: step.approver_email,
          label: step.label
        })
      ]
    );
  }

  return sent;
}

async function notifyRequesterUpdate(request: RequestDetailRecord, actedStep: RequestStepRecord, pendingStep?: RequestStepRecord) {
  const finalRequest = request.status === "approved" || request.status === "completed";
  const rejectedRequest = request.status === "rejected" || actedStep.decision === "reject";
  const extraRows: Array<[string, string]> = [
    ["Estado actual", translateStatus(request.status)],
    ["Fecha de actualizacion", formatDateTime(actedStep.acted_at)]
  ];

  if (pendingStep) {
    extraRows.push(["Siguiente responsable", `${pendingStep.approver_name} (${pendingStep.label})`]);
  }

  const subject = rejectedRequest
    ? `SSD | Solicitud rechazada ${request.ticket_code}`
    : finalRequest
      ? `SSD | Solicitud finalizada ${request.ticket_code}`
      : `SSD | Solicitud actualizada ${request.ticket_code}`;

  const title = rejectedRequest ? "Solicitud rechazada" : finalRequest ? "Solicitud finalizada" : "Solicitud actualizada";
  const subtitle = rejectedRequest
    ? "Tu solicitud fue rechazada en el flujo de aprobacion."
    : finalRequest
      ? "Tu solicitud completo su proceso en SSD."
      : "Tu solicitud avanzo al siguiente paso del flujo.";
  const tone: EmailTone = rejectedRequest ? "danger" : finalRequest ? "success" : "info";
  const categoryLabel = rejectedRequest ? "Rechazo" : finalRequest ? "Finalizada" : "Actualizacion";

  return sendEmail({
    to: request.requester_email,
    subject,
    tag: "requester_update",
    request,
    html: await renderNotificationTemplate({
      previewText: `${title} ${request.ticket_code}`,
      tone,
      categoryLabel,
      title,
      subtitle,
      greetingName: request.requester_name,
      introText: `El paso ${actedStep.label} fue marcado como ${translateDecision(actedStep.decision, actedStep.status)}.`,
      statusLabel: translateStatus(request.status),
      statusDetail: pendingStep
        ? `La solicitud continua con ${pendingStep.approver_name} en el paso ${pendingStep.label}.`
        : "La solicitud ya no tiene pasos pendientes en SSD.",
      summaryHeading: rejectedRequest ? "Resultado del flujo" : finalRequest ? "Cierre del proceso" : "Movimiento del flujo",
      summaryRows: [
        { label: "Paso atendido", value: actedStep.label },
        { label: "Responsable", value: actedStep.approver_name },
        { label: "Fecha y hora", value: formatDateTime(actedStep.acted_at) },
        { label: "Siguiente responsable", value: pendingStep ? `${pendingStep.approver_name} (${pendingStep.label})` : "Sin pasos pendientes" }
      ],
      detailHeading: "Detalle de la solicitud",
      detailRows: buildRequestSummaryRows(request, actedStep, extraRows),
      signature: buildSignatureData(actedStep),
      actionLabel: "Ver detalle",
      actionUrl: requestUrl(request)
    })
  });
}

async function notifyAdminsMobileLineApproved(request: RequestDetailRecord, actedStep: RequestStepRecord) {
  const recipients = await getAdminRecipients();

  if (recipients.length === 0) {
    logNotification("warn", "No hay administradores para notificar linea aprobada", {
      requestId: request.id,
      ticket: request.ticket_code
    });
    return false;
  }

  const beneficiaries = parseBeneficiaries(request);
  const linksHtml =
    beneficiaries.length > 0 ? buildResponsivaLinks(request) : [];

  return sendEmail({
    to: recipients.join(", "),
    subject: `SSD | Linea aprobada por GG ${request.ticket_code}`,
    tag: "mobile_line_admin_ready",
    request,
    html: await renderNotificationTemplate({
      previewText: `Linea aprobada por GG ${request.ticket_code}`,
      tone: "admin",
      categoryLabel: "Administracion",
      title: "Linea celular aprobada por Gerencia General",
      subtitle: "La solicitud ya puede ser atendida administrativamente y sus cartas responsivas estan disponibles.",
      greetingName: "equipo administrador",
      introText: `La solicitud de linea celular fue aprobada por ${actedStep.approver_name}.`,
      statusLabel: "Aprobada por GG",
      statusDetail: "La solicitud paso la aprobacion ejecutiva y ya puede avanzar a la atencion administrativa.",
      summaryHeading: "Seguimiento administrativo",
      summaryRows: [
        { label: "Ticket", value: request.ticket_code },
        { label: "Solicitante", value: request.requester_name },
        { label: "Departamento", value: request.department },
        { label: "Beneficiarios", value: parseBeneficiaries(request).join(", ") || "N/A" }
      ],
      detailHeading: "Detalle de la solicitud",
      detailRows: buildRequestSummaryRows(request, actedStep, [
        ["Estado actual", translateStatus(request.status)],
        ["Fecha de aprobacion GG", formatDateTime(actedStep.acted_at)]
      ]),
      linksHeading: "Cartas responsivas por beneficiario",
      links: linksHtml,
      actionLabel: "Abrir solicitud",
      actionUrl: requestUrl(request)
    })
  });
}

async function runNotificationBatch(batchName: string, request: RequestDetailRecord, tasks: NotificationTask[]) {
  const results = await Promise.allSettled(tasks.map((task) => task.run()));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logNotification("error", "Notificacion fallida", {
        batchName,
        task: tasks[index].name,
        requestId: request.id,
        ticket: request.ticket_code,
        reason
      });
    }
  });
}

export async function notifyRequestCreated(request: RequestDetailRecord) {
  const pendingStep = findPendingStep(request);

  await runNotificationBatch("request_created", request, [
    {
      name: "requester_created",
      run: () => notifyRequesterCreated(request)
    },
    ...(pendingStep
      ? [
          {
            name: "first_approver_pending",
            run: () => notifyApprover(request, pendingStep)
          }
        ]
      : []),
    {
      name: "teams_created",
      run: () =>
        sendTeamsMessage(
          "Nueva solicitud registrada",
          pendingStep ? [`Paso pendiente: ${pendingStep.label}`, `Responsable: ${pendingStep.approver_name}`] : [],
          request
        )
    }
  ]);
}

export async function notifyRequestUpdated(request: RequestDetailRecord) {
  const pendingStep = findPendingStep(request);
  const actedStep = findLastActedStep(request);

  await runNotificationBatch("request_updated", request, [
    ...(actedStep
      ? [
          {
            name: "requester_update",
            run: () => notifyRequesterUpdate(request, actedStep, pendingStep)
          }
        ]
      : []),
    ...(pendingStep
      ? [
          {
            name: "next_approver_pending",
            run: () => notifyApprover(request, pendingStep)
          }
        ]
      : []),
    ...(isMobileLineApprovedByGg(request, actedStep)
      ? [
          {
            name: "admins_mobile_line_ready",
            run: () => notifyAdminsMobileLineApproved(request, actedStep as RequestStepRecord)
          }
        ]
      : []),
    {
      name: "teams_updated",
      run: () =>
        sendTeamsMessage(
          "Solicitud actualizada",
          [
            actedStep ? `Ultimo paso: ${actedStep.label}` : "Sin ultimo paso",
            actedStep ? `Decision: ${translateDecision(actedStep.decision, actedStep.status)}` : "Sin decision",
            pendingStep ? `Siguiente responsable: ${pendingStep.approver_name}` : "Flujo sin pasos pendientes"
          ],
          request
        )
    }
  ]);
}
