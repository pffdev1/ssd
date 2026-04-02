import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }
});

type Row = Record<string, unknown>;
type Decision = "approve" | "reject" | "complete";
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const J = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
}});

const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const body = async (r: Request) => (r.method === "GET" || r.method === "DELETE") ? {} : await r.json().catch(() => ({}));
const reqSel = "id,ticket_code,status,requester_name,requester_email,department,beneficiary_name,subject,justification,payload,created_at,updated_at,request_type_id,request_types!inner(code,name,category)";
const flatReq = (r: Row) => ({ ...r, request_type_code: (r.request_types as Row)?.code ?? "", request_type_name: (r.request_types as Row)?.name ?? "", category: (r.request_types as Row)?.category ?? "" });
const PANAMA_LOCALE = "es-PA";
const PANAMA_TIMEZONE = "America/Panama";
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") ?? Deno.env.get("EXPO_PUBLIC_WEB_URL") ?? "http://localhost:8081").replace(/\/+$/, "");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? Deno.env.get("SMTP_FROM") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_API_URL = Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails";
let emailConfigLogged = false;

function logNotification(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger(`[notifications] ${message}${suffix}`);
}

function canSendEmail() {
  const ready = Boolean(RESEND_API_KEY && EMAIL_FROM);
  if (!ready && !emailConfigLogged) {
    logNotification("warn", "Correos deshabilitados. Configura RESEND_API_KEY y EMAIL_FROM (o SMTP_FROM)");
    emailConfigLogged = true;
  }
  return ready;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Pendiente";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(PANAMA_LOCALE, {
    timeZone: PANAMA_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(item)).filter((item) => item !== "N/A");
    return items.length ? items.join(", ") : "N/A";
  }
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const candidate = ["nombre", "name", "label", "fullName"].find((key) => typeof objectValue[key] === "string");
    if (candidate) return String(objectValue[candidate]);
    try {
      return JSON.stringify(objectValue);
    } catch {
      return String(objectValue);
    }
  }
  return String(value);
}

function translateStatus(status: string) {
  switch (status) {
    case "pending_area_approval": return "Pendiente de gerencia de area";
    case "pending_general_management": return "Pendiente de gerencia general";
    case "pending_hr": return "Pendiente de RRHH";
    case "pending_finance": return "Pendiente de revision presupuestaria";
    case "pending_it": return "Pendiente de TI";
    case "pending_review": return "Pendiente de revision";
    case "in_fulfillment": return "En ejecucion";
    case "approved": return "Aprobada";
    case "completed": return "Completada";
    case "rejected": return "Rechazada";
    case "pending": return "Pendiente";
    case "queued": return "En cola";
    default: return status;
  }
}

function translateDecision(decision?: unknown, fallbackStatus?: unknown) {
  switch (String(decision ?? "")) {
    case "approve": return "Aprobada";
    case "reject": return "Rechazada";
    case "complete": return "Completada";
    default: return translateStatus(String(fallbackStatus ?? "updated"));
  }
}

function requestUrl(requestId: string) {
  return `${APP_BASE_URL}/requests/${requestId}`;
}

function inboxUrl() {
  return `${APP_BASE_URL}/inbox`;
}

function renderRows(rows: Array<[string, unknown]>) {
  return rows.map(([label, value]) => `
      <tr>
        <td style="padding:10px;border:1px solid #d7e4f2;background:#f8fbff;font-weight:600;color:#001534">${escapeHtml(label)}</td>
        <td style="padding:10px;border:1px solid #d7e4f2;color:#1e3a5f">${escapeHtml(formatValue(value))}</td>
      </tr>
    `).join("");
}

function renderPayloadRows(payload: Row) {
  const rows = Object.entries(payload)
    .map(([key, value]) => [key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()), formatValue(value)] as [string, string])
    .filter(([, value]) => value !== "N/A");

  if (!rows.length) return "";
  return `
    <h3 style="margin:20px 0 8px;color:#001534">Detalle del formulario</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
      ${renderRows(rows)}
    </table>
  `;
}

function renderEmail(input: {
  title: string;
  intro: string;
  rows: Array<[string, unknown]>;
  payload?: Row;
  actionLabel?: string;
  actionUrl?: string;
}) {
  return `
    <div style="margin:0;padding:20px;background:#f3f7fc;color:#0f172a;font-family:Segoe UI,Arial,sans-serif">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;margin:0 auto;border-collapse:collapse">
        <tr>
          <td style="background:#ffffff;border:1px solid #bfd2e7;border-radius:20px;overflow:hidden">
            <div style="padding:20px 24px;background:linear-gradient(180deg,#eef4ff 0%,#dfeeff 100%);border-bottom:1px solid #bfd2e7">
              <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#1f406b;font-weight:700">Pedersen Connect</div>
              <h2 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#001534">${escapeHtml(input.title)}</h2>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#1e3a5f">${escapeHtml(input.intro)}</p>
            </div>
            <div style="padding:24px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                ${renderRows(input.rows)}
              </table>
              ${input.payload ? renderPayloadRows(input.payload) : ""}
              ${input.actionLabel && input.actionUrl
                ? `<div style="margin-top:22px">
                    <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#0b5ed7;color:#ffffff !important;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">
                      ${escapeHtml(input.actionLabel)}
                    </a>
                  </div>`
                : ""}
            </div>
            <div style="padding:14px 24px;border-top:1px solid #d7e4f2;background:#f9fbff;font-size:12px;line-height:1.6;color:#46607d">
              Pedersen Fine Foods | Mensaje automatico del Sistema de Solicitudes Digital
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

type NotificationRequest = Row & { id: string; status: string; payload: Row; steps: Row[] };

async function getRequestForNotifications(requestId: string): Promise<NotificationRequest | null> {
  const [{ data: req, error: re }, { data: steps, error: se }] = await Promise.all([
    supabase.from("requests").select(reqSel).eq("id", requestId).maybeSingle(),
    supabase.from("request_steps").select("*").eq("request_id", requestId).order("sequence", { ascending: true })
  ]);
  if (re || se) throw new Error("No se pudo cargar detalle para notificaciones");
  if (!req) return null;
  const flat = flatReq(req as Row) as Row;
  return { ...flat, id: String(flat.id), status: String(flat.status), payload: (flat.payload as Row) ?? {}, steps: (steps ?? []) as Row[] };
}

function findPendingStep(request: NotificationRequest) {
  return request.steps.find((step) => String(step.status ?? "") === "pending");
}

function findLastActedStep(request: NotificationRequest) {
  return [...request.steps]
    .filter((step) => Boolean(step.acted_at))
    .sort((a, b) => new Date(String(b.acted_at ?? "")).getTime() - new Date(String(a.acted_at ?? "")).getTime())[0];
}

function isMobileLineApprovedByGg(request: NotificationRequest, actedStep?: Row) {
  return Boolean(
    actedStep &&
    String(request.request_type_code ?? "") === "MOBILE_LINE_REQUEST" &&
    String(actedStep.role_code ?? "") === "GG_APPROVAL" &&
    String(actedStep.decision ?? "") === "approve"
  );
}

async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  tag: string;
  request: NotificationRequest;
}) {
  const recipients = (Array.isArray(input.to) ? input.to : input.to.split(","))
    .map((value) => normEmail(value))
    .filter(Boolean);

  if (!recipients.length) return false;
  if (!canSendEmail()) return false;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      tags: [
        { name: "source", value: "supabase-function" },
        { name: "type", value: input.tag }
      ]
    })
  });

  if (!response.ok) {
    const text = (await response.text()).slice(0, 400);
    throw new Error(`Resend fallo (${response.status}): ${text}`);
  }

  logNotification("info", "Correo enviado", {
    tag: input.tag,
    ticket: input.request.ticket_code,
    recipients
  });
  return true;
}

async function alreadyNotifiedPendingStep(requestId: string, stepId: string) {
  const { count, error } = await supabase
    .from("request_events")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("event_type", "STEP_PENDING_NOTIFIED")
    .contains("payload", { stepId });
  if (error) {
    logNotification("warn", "No se pudo validar deduplicacion de paso pendiente", { requestId, stepId, error: error.message });
    return false;
  }
  return (count ?? 0) > 0;
}

async function markPendingStepNotified(request: NotificationRequest, step: Row) {
  const payload = {
    stepId: String(step.id ?? ""),
    approverEmail: normEmail(step.approver_email),
    label: String(step.label ?? "")
  };
  const { error } = await supabase.from("request_events").insert({
    request_id: request.id,
    event_type: "STEP_PENDING_NOTIFIED",
    actor_name: "SSD Notifications",
    actor_email: "noreply@ssd.local",
    notes: `Notificacion de paso pendiente enviada a ${payload.approverEmail}`,
    payload
  });
  if (error) {
    logNotification("warn", "No se pudo registrar evento de notificacion de paso pendiente", {
      requestId: request.id,
      stepId: payload.stepId,
      reason: error.message
    });
  }
}

function baseRows(request: NotificationRequest, step?: Row, extra: Array<[string, unknown]> = []) {
  const rows: Array<[string, unknown]> = [
    ["Ticket", request.ticket_code],
    ["Tipo", request.request_type_name],
    ["Solicitante", `${request.requester_name} (${request.requester_email})`],
    ["Departamento", request.department],
    ["Asunto", request.subject],
    ["Justificacion", request.justification]
  ];
  if (step) rows.splice(4, 0, ["Paso", step.label]);
  rows.push(...extra);
  return rows;
}

async function notifyRequesterCreated(request: NotificationRequest, pendingStep?: Row) {
  await sendEmail({
    to: String(request.requester_email ?? ""),
    subject: `SSD | Solicitud registrada ${request.ticket_code}`,
    tag: "requester_created",
    request,
    html: renderEmail({
      title: "Solicitud registrada",
      intro: "Tu solicitud fue registrada en SSD y ya esta en flujo de atencion.",
      rows: baseRows(request, undefined, [
        ["Estado", translateStatus(String(request.status ?? ""))],
        ["Primer responsable", pendingStep ? `${String(pendingStep.approver_name ?? "")} (${String(pendingStep.label ?? "")})` : "Pendiente de configuracion"],
        ["Fecha de registro", formatDateTime(request.created_at)]
      ]),
      payload: request.payload,
      actionLabel: "Ver solicitud",
      actionUrl: requestUrl(request.id)
    })
  });
}

async function notifyApproverPending(request: NotificationRequest, step: Row) {
  const stepId = String(step.id ?? "");
  if (!stepId) return;
  if (await alreadyNotifiedPendingStep(request.id, stepId)) return;

  const sent = await sendEmail({
    to: String(step.approver_email ?? ""),
    subject: `SSD | Accion requerida ${request.ticket_code}`,
    tag: "approver_pending",
    request,
    html: renderEmail({
      title: "Accion requerida",
      intro: `Tienes una solicitud pendiente en el paso ${String(step.label ?? "")}.`,
      rows: baseRows(request, step, [
        ["Tipo de accion", String(step.kind ?? "") === "fulfillment" ? "Ejecucion requerida" : "Aprobacion requerida"],
        ["Estado actual", translateStatus(String(request.status ?? ""))]
      ]),
      payload: request.payload,
      actionLabel: "Abrir bandeja",
      actionUrl: inboxUrl()
    })
  });

  if (sent) {
    await markPendingStepNotified(request, step);
  }
}

async function notifyRequesterUpdate(request: NotificationRequest, actedStep: Row, pendingStep?: Row) {
  const rejected = String(request.status) === "rejected" || String(actedStep.decision ?? "") === "reject";
  const completed = String(request.status) === "approved" || String(request.status) === "completed";
  const title = rejected ? "Solicitud rechazada" : completed ? "Solicitud finalizada" : "Solicitud actualizada";
  const intro = rejected
    ? "Tu solicitud fue rechazada dentro del flujo de atencion."
    : completed
      ? "Tu solicitud completo el flujo en SSD."
      : "Tu solicitud avanzo al siguiente paso del flujo.";

  await sendEmail({
    to: String(request.requester_email ?? ""),
    subject: `SSD | ${title} ${request.ticket_code}`,
    tag: "requester_update",
    request,
    html: renderEmail({
      title,
      intro,
      rows: baseRows(request, actedStep, [
        ["Estado actual", translateStatus(String(request.status ?? ""))],
        ["Decision", translateDecision(actedStep.decision, actedStep.status)],
        ["Responsable", String(actedStep.approver_name ?? "")],
        ["Fecha de actualizacion", formatDateTime(actedStep.acted_at)],
        ["Siguiente responsable", pendingStep ? `${String(pendingStep.approver_name ?? "")} (${String(pendingStep.label ?? "")})` : "Sin pasos pendientes"]
      ]),
      payload: request.payload,
      actionLabel: "Ver solicitud",
      actionUrl: requestUrl(request.id)
    })
  });
}

async function getAdminRecipientEmails() {
  const { data, error } = await supabase.from("admin_users").select("email").order("full_name", { ascending: true }).order("email", { ascending: true });
  if (error) throw new Error("No se pudo cargar administradores para notificaciones");
  return Array.from(new Set((data ?? []).map((row) => normEmail(row.email)).filter(Boolean)));
}

async function notifyAdminsMobileLineReady(request: NotificationRequest, actedStep: Row) {
  const recipients = await getAdminRecipientEmails();
  if (!recipients.length) return;

  await sendEmail({
    to: recipients,
    subject: `SSD | Linea aprobada por GG ${request.ticket_code}`,
    tag: "mobile_line_admin_ready",
    request,
    html: renderEmail({
      title: "Linea movil aprobada por GG",
      intro: "La solicitud de linea movil esta lista para gestion administrativa y documentos de responsiva.",
      rows: baseRows(request, actedStep, [
        ["Estado actual", translateStatus(String(request.status ?? ""))],
        ["Aprobado por", String(actedStep.approver_name ?? "")],
        ["Fecha de aprobacion GG", formatDateTime(actedStep.acted_at)]
      ]),
      payload: request.payload,
      actionLabel: "Revisar solicitud",
      actionUrl: requestUrl(request.id)
    })
  });
}

async function runNotificationBatch(batchName: string, request: NotificationRequest, tasks: Array<{ name: string; run: () => Promise<unknown> }>) {
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logNotification("error", "Notificacion fallida", {
        batchName,
        task: tasks[index].name,
        requestId: request.id,
        ticket: request.ticket_code,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });
}

async function notifyRequestCreated(requestId: string) {
  const request = await getRequestForNotifications(requestId);
  if (!request) return;
  const pendingStep = findPendingStep(request);
  const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: "requester_created", run: () => notifyRequesterCreated(request, pendingStep) }
  ];
  if (pendingStep) {
    tasks.push({ name: "first_approver_pending", run: () => notifyApproverPending(request, pendingStep) });
  }
  await runNotificationBatch("request_created", request, tasks);
}

async function notifyRequestUpdated(requestId: string) {
  const request = await getRequestForNotifications(requestId);
  if (!request) return;
  const pendingStep = findPendingStep(request);
  const actedStep = findLastActedStep(request);
  const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [];
  if (actedStep) {
    tasks.push({ name: "requester_update", run: () => notifyRequesterUpdate(request, actedStep, pendingStep) });
  }
  if (pendingStep) {
    tasks.push({ name: "next_approver_pending", run: () => notifyApproverPending(request, pendingStep) });
  }
  if (actedStep && isMobileLineApprovedByGg(request, actedStep)) {
    tasks.push({ name: "admins_mobile_line_ready", run: () => notifyAdminsMobileLineReady(request, actedStep) });
  }
  if (!tasks.length) return;
  await runNotificationBatch("request_updated", request, tasks);
}

async function isAdmin(email: string) {
  const e = normEmail(email);
  if (!e) return false;
  const { data, error } = await supabase.from("admin_users").select("id").ilike("email", e).limit(1);
  if (error) throw new HttpError(500, "No se pudo verificar permisos de administrador");
  return (data ?? []).length > 0;
}
async function assertAdmin(actor: unknown) { const e = normEmail(actor); if (!e) throw new HttpError(400, "El actor es requerido"); if (!(await isAdmin(e))) throw new HttpError(403, "Solo un administrador puede acceder a este recurso"); return e; }

async function listRequestTypes() {
  const [{ data: types, error: te }, { data: items, error: ie }] = await Promise.all([
    supabase.from("request_types").select("*").eq("active", true).order("name", { ascending: true }),
    supabase.from("catalog_items").select("*").eq("active", true).order("catalog_key", { ascending: true }).order("sort_order", { ascending: true })
  ]);
  if (te || ie) throw new HttpError(500, "No se pudo cargar catalogo");
  const grouped = new Map<string, Row[]>();
  for (const item of items ?? []) { const k = String(item.catalog_key ?? ""); if (!grouped.has(k)) grouped.set(k, []); grouped.get(k)!.push(item as Row); }
  const map: Record<string, Record<string, string>> = { IT_ASSET_REQUEST: { tipoActivo: "IT_ASSET_TYPE" }, MOBILE_LINE_REQUEST: { planSugerido: "MOBILE_PLAN" } };
  return (types ?? []).map((t) => {
    const fm = map[String(t.code ?? "")];
    if (!fm || !Array.isArray(t.fields)) return t;
    return { ...t, fields: t.fields.map((f: Row) => { const ck = fm[String(f.name ?? "")]; return ck ? ({ ...f, options: (grouped.get(ck) ?? []).map((x) => ({ option: x.item_value })) }) : f; }) };
  });
}

async function visibleRequests(actor?: string) {
  const a = normEmail(actor);
  if (!a || await isAdmin(a)) {
    const { data, error } = await supabase.from("requests").select(reqSel).order("created_at", { ascending: false });
    if (error) throw new HttpError(500, "No se pudo cargar solicitudes");
    return (data ?? []).map((r) => flatReq(r as Row));
  }
  const [mine, steps] = await Promise.all([
    supabase.from("requests").select(reqSel).ilike("requester_email", a),
    supabase.from("request_steps").select("request_id").ilike("approver_email", a)
  ]);
  if (mine.error || steps.error) throw new HttpError(500, "No se pudo cargar solicitudes");
  const out = new Map<string, Row>();
  for (const r of mine.data ?? []) out.set(String(r.id), flatReq(r as Row));
  const ids = Array.from(new Set((steps.data ?? []).map((s) => String(s.request_id))));
  if (ids.length) {
    const { data, error } = await supabase.from("requests").select(reqSel).in("id", ids);
    if (error) throw new HttpError(500, "No se pudo cargar solicitudes");
    for (const r of data ?? []) out.set(String(r.id), flatReq(r as Row));
  }
  return Array.from(out.values()).sort((x, y) => new Date(String(y.created_at ?? "")).getTime() - new Date(String(x.created_at ?? "")).getTime());
}

async function requestDetail(id: string, actor?: string) {
  const a = normEmail(actor);
  if (a && !(await isAdmin(a))) {
    const [mine, step] = await Promise.all([
      supabase.from("requests").select("id").eq("id", id).ilike("requester_email", a).maybeSingle(),
      supabase.from("request_steps").select("id").eq("request_id", id).ilike("approver_email", a).limit(1)
    ]);
    if (!mine.data?.id && (step.data ?? []).length === 0) return null;
  }
  const [{ data: req, error: re }, { data: steps, error: se }, { data: ev, error: ee }] = await Promise.all([
    supabase.from("requests").select(reqSel).eq("id", id).maybeSingle(),
    supabase.from("request_steps").select("*").eq("request_id", id).order("sequence", { ascending: true }),
    supabase.from("request_events").select("*").eq("request_id", id).order("created_at", { ascending: true })
  ]);
  if (re || se || ee) throw new HttpError(500, "No se pudo cargar solicitud");
  if (!req) return null;
  return { ...flatReq(req as Row), steps: steps ?? [], events: ev ?? [] };
}

const stepStatus = (s?: Row) => {
  if (!s) return "completed";
  if (String(s.kind ?? "") === "fulfillment") return "in_fulfillment";
  switch (String(s.role_code ?? s.code ?? "")) {
    case "AREA_MANAGER": return "pending_area_approval";
    case "GG_APPROVAL": return "pending_general_management";
    case "HR_REVIEW": return "pending_hr";
    case "FINANCE_REVIEW": return "pending_finance";
    case "IT_REVIEW": return "pending_it";
    default: return "pending_review";
  }
};

async function createTicketCode() {
  const { count, error } = await supabase.from("requests").select("id", { count: "exact", head: true });
  if (error) throw new HttpError(500, "No se pudo generar correlativo");
  return `SSD-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

async function findApprover(roleCode: string, routing: string, scope: string, department: string) {
  let q = supabase.from("approvers").select("*").eq("role_code", normCode(roleCode)).order("assignment_role", { ascending: true }).order("sort_order", { ascending: true }).limit(1);
  if (routing === "department") q = q.eq("department", department); else q = q.eq("scope", normCode(scope || roleCode)).is("department", null);
  const { data, error } = await q;
  if (error) throw new HttpError(500, "No se pudo resolver aprobador");
  return (data ?? [])[0] ?? null;
}

async function signature(requestId: string, stepId: string, actorName: string, actorEmail: string, decision: Decision) {
  const signedAt = new Date().toISOString();
  const seed = `${requestId}|${stepId}|${normEmail(actorEmail)}|${decision}|${signedAt}`;
  const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const digest = Array.from(new Uint8Array(digestBytes)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24).toUpperCase();
  return { signatureId: `SSD-SIG-${digest}`, signerName: actorName, signerEmail: normEmail(actorEmail), decision, signedAt, provider: "SSD_CORPORATE_SESSION", algorithm: "SHA-256", digest };
}

async function workflowTemplates(includeInactive = true) {
  let q = supabase.from("workflow_step_templates").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new HttpError(500, "No se pudo cargar pasos");
  const { data: ap } = await supabase.from("approvers").select("*").is("department", null);
  return (data ?? []).map((s) => {
    const scope = String(s.routing ?? "") === "scope" ? String(s.scope ?? s.code ?? "") : "AREA";
    const r = (ap ?? []).find((a) => String(a.role_code ?? "") === String(s.code ?? "") && String(a.scope ?? "") === scope);
    return { ...s, responsible_name: r?.full_name ?? null, responsible_email: r?.email ?? null, responsible_title: r?.title ?? null };
  });
}

async function workflowDefinition(stepCodes: string[]) {
  const codes = stepCodes.map((x) => normCode(x)).filter(Boolean);
  if (!codes.length) throw new HttpError(400, "Debes mantener al menos un paso en el workflow");
  if (new Set(codes).size !== codes.length) throw new HttpError(400, "No se permiten pasos duplicados en el workflow");
  const by = new Map((await workflowTemplates(true)).map((t) => [String(t.code), t]));
  const steps = codes.map((c) => { const t = by.get(c); if (!t) throw new HttpError(400, `Paso no permitido en el workflow: ${c}`); return { code: t.code, label: t.label, kind: t.kind, routing: t.routing, scope: t.scope ?? undefined }; });
  return { steps, requiresGeneralManagement: codes.includes("GG_APPROVAL") };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return J({ ok: true });
  try {
    const u = new URL(request.url);
    const p =
      u.pathname
        .replace(/^\/functions\/v1\/api/, "")
        .replace(/^\/api/, "") || "/";

    if (request.method === "GET" && p === "/health") return J({ ok: true, service: "ssd-supabase-api" });

    if (request.method === "GET" && p === "/catalog") {
      const [{ data: dep, error: de }, types, appr] = await Promise.all([
        supabase.from("catalog_items").select("item_value").eq("catalog_key", "DEPARTMENT").eq("active", true).order("sort_order", { ascending: true }),
        listRequestTypes(),
        supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true })
      ]);
      if (de || appr.error) throw new HttpError(500, "No se pudo cargar catalogo");
      return J({ requestTypes: types, departments: (dep ?? []).map((x) => x.item_value), approvers: appr.data ?? [] });
    }

    if (request.method === "GET" && p === "/dashboard") {
      const rows = await visibleRequests(u.searchParams.get("actorEmail") ?? undefined);
      const metrics = new Map<string, number>(), byType = new Map<string, number>();
      for (const r of rows) { const s = String(r.status ?? ""), t = String(r.request_type_name ?? ""); metrics.set(s, (metrics.get(s) ?? 0) + 1); byType.set(t, (byType.get(t) ?? 0) + 1); }
      const ids = rows.map((r) => String(r.id));
      const pending = ids.length ? await supabase.from("request_steps").select("approver_name").eq("status", "pending").in("request_id", ids) : { data: [] as Row[] };
      const pm = new Map<string, number>();
      for (const s of pending.data ?? []) { const n = String(s.approver_name ?? ""); pm.set(n, (pm.get(n) ?? 0) + 1); }
      return J({ metrics: Array.from(metrics.entries()).map(([status, total]) => ({ status, total: String(total) })), byType: Array.from(byType.entries()).map(([name, total]) => ({ name, total: String(total) })), pendingByApprover: Array.from(pm.entries()).map(([approver_name, pending]) => ({ approver_name, pending: String(pending) })), recentRequests: rows.slice(0, 6) });
    }

    if (request.method === "GET" && p === "/requests") {
      let rows = await visibleRequests(u.searchParams.get("actorEmail") ?? undefined);
      const req = normEmail(u.searchParams.get("requesterEmail"));
      if (req) rows = rows.filter((r) => normEmail(r.requester_email) === req);
      return J(rows);
    }

    if (request.method === "GET" && p === "/requests/inbox") {
      const e = normEmail(u.searchParams.get("email"));
      if (!e) return J({ message: "El correo del aprobador es requerido" }, 400);
      const { data: steps, error: se } = await supabase.from("request_steps").select("id,request_id,label,kind,sequence,approver_name,approver_email,status,created_at").eq("status", "pending").ilike("approver_email", e);
      if (se) throw new HttpError(500, "No se pudo cargar inbox");
      const ids = Array.from(new Set((steps ?? []).map((s) => String(s.request_id))));
      if (!ids.length) return J([]);
      const { data: reqs, error: re } = await supabase.from("requests").select(reqSel).in("id", ids);
      if (re) throw new HttpError(500, "No se pudo cargar inbox");
      const map = new Map((reqs ?? []).map((r) => [String(r.id), flatReq(r as Row)]));
      return J((steps ?? []).map((s) => { const r = map.get(String(s.request_id)); return r ? ({ ...r, step_id: s.id, step_label: s.label, step_kind: s.kind, step_sequence: s.sequence, approver_name: s.approver_name, approver_email: s.approver_email, step_status: s.status, step_created_at: s.created_at }) : null; }).filter(Boolean));
    }

    if (request.method === "GET" && p === "/approvers/profile") {
      const e = normEmail(u.searchParams.get("email"));
      if (!e) return J({ message: "El correo del aprobador es requerido" }, 400);
      const { data, error } = await supabase.from("approvers").select("*").ilike("email", e);
      if (error) throw new HttpError(500, "No se pudo cargar perfil");
      return J(data ?? []);
    }

    if (request.method === "GET" && /^\/requests\/[^/]+$/.test(p)) {
      const d = await requestDetail(p.split("/")[2], u.searchParams.get("actorEmail") ?? undefined);
      return d ? J(d) : J({ message: "Solicitud no encontrada" }, 404);
    }

    if (request.method === "POST" && p === "/requests") {
      const b = (await body(request)) as Row;
      const rtCode = normCode(b.requestTypeCode), requesterName = String(b.requesterName ?? "").trim(), requesterEmail = normEmail(b.requesterEmail), managerEmail = normEmail(b.requesterManagerEmail), managerName = String(b.requesterManagerName ?? "").trim(), managerTitle = String(b.requesterManagerTitle ?? "").trim(), department = String(b.department ?? "").trim(), beneficiaryName = String(b.beneficiaryName ?? "").trim(), subject = String(b.subject ?? "").trim(), justification = String(b.justification ?? "").trim(), payload = (b.payload ?? {}) as Row;
      if (!rtCode || !requesterName || !requesterEmail || !department || !subject || !justification) throw new HttpError(400, "Faltan campos requeridos para crear la solicitud");
      const { data: rt, error: rte } = await supabase.from("request_types").select("*").eq("code", rtCode).eq("active", true).maybeSingle();
      if (rte) throw new HttpError(500, "No se pudo cargar tipo de solicitud");
      if (!rt) throw new HttpError(400, "Tipo de solicitud no encontrado o inactivo");
      const wf = Array.isArray(rt.workflow?.steps) ? (rt.workflow.steps as Row[]) : [];
      if (!wf.length) throw new HttpError(400, "Este tipo de solicitud no tiene workflow configurado");
      const steps: Row[] = [];
      for (let i = 0; i < wf.length; i++) {
        const s = wf[i], role = normCode(s.code), routing = String(s.routing ?? "");
        const a = (role === "AREA_MANAGER" && managerEmail) ? ({ full_name: managerName || managerEmail, email: managerEmail, title: managerTitle || "Manager", department } as Row) : await findApprover(role, routing, String(s.scope ?? ""), department);
        if (!a) throw new HttpError(400, `No se encontro aprobador para el paso ${role}`);
        steps.push({ sequence: i + 1, role_code: role, label: String(s.label ?? role), kind: String(s.kind ?? "approval"), approver_name: a.full_name, approver_email: normEmail(a.email), department: a.department ?? null, status: i === 0 ? "pending" : "queued", metadata: { scope: routing === "scope" ? normCode(s.scope ?? role) : "AREA", title: a.title ?? null } });
      }
      const ticket = await createTicketCode();
      const { data: r, error: re } = await supabase.from("requests").insert({ request_type_id: rt.id, ticket_code: ticket, status: stepStatus(steps[0]), requester_name: requesterName, requester_email: requesterEmail, department, beneficiary_name: beneficiaryName || null, subject, justification, payload }).select("id,ticket_code,status").single();
      if (re) throw new HttpError(500, "No se pudo crear solicitud");
      const { error: se } = await supabase.from("request_steps").insert(steps.map((s) => ({ ...s, request_id: r.id })));
      if (se) throw new HttpError(500, "No se pudo crear pasos de solicitud");
      await supabase.from("request_events").insert({ request_id: r.id, event_type: "REQUEST_CREATED", actor_name: requesterName, actor_email: requesterEmail, notes: `Solicitud registrada para ${rt.name}`, payload: { ticketCode: ticket, requestType: rt.code } });
      try {
        await notifyRequestCreated(String(r.id));
      } catch (error) {
        logNotification("error", "Fallo notificacion de solicitud creada", {
          requestId: r.id,
          ticketCode: r.ticket_code,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
      return J({ requestId: r.id, ticketCode: r.ticket_code, status: r.status }, 201);
    }

    if (request.method === "POST" && /^\/requests\/[^/]+\/steps\/[^/]+\/decision$/.test(p)) {
      const parts = p.split("/"), requestId = parts[2], stepId = parts[4], b = (await body(request)) as Row;
      const decision = String(b.decision ?? "") as Decision, actorName = String(b.actorName ?? "Sistema"), actorEmail = normEmail(b.actorEmail), comments = String(b.comments ?? "").trim();
      if (!requestId || !stepId || !actorEmail || !["approve", "reject", "complete"].includes(decision)) throw new HttpError(400, "Datos insuficientes para procesar decision");
      const { data: cur, error: ce } = await supabase.from("request_steps").select("*").eq("id", stepId).eq("request_id", requestId).maybeSingle();
      if (ce) throw new HttpError(500, "No se pudo cargar paso de solicitud");
      if (!cur) throw new HttpError(404, "Step not found for request");
      if (cur.status !== "pending") throw new HttpError(400, "Only the pending step can receive a decision");
      if (normEmail(cur.approver_email) !== actorEmail) throw new HttpError(403, "This step can only be processed by the assigned approver");
      if (cur.kind === "approval" && decision === "complete") throw new HttpError(400, "Approval steps only accept approve or reject");
      if (cur.kind === "fulfillment" && decision === "approve") throw new HttpError(400, "Fulfillment steps should be completed or rejected");
      const mapped = decision === "reject" ? "rejected" : decision === "complete" ? "completed" : "approved";
      const ds = await signature(requestId, stepId, actorName, actorEmail, decision);
      await supabase.from("request_steps").update({ status: mapped, decision, comments: comments || null, acted_at: new Date().toISOString(), metadata: { ...(cur.metadata ?? {}), digitalSignature: ds } }).eq("id", stepId);
      if (decision === "reject") {
        await Promise.all([
          supabase.from("requests").update({ status: "rejected" }).eq("id", requestId),
          supabase.from("request_events").insert({ request_id: requestId, event_type: "STEP_REJECTED", actor_name: actorName, actor_email: actorEmail, notes: `${String(cur.label)} rechazado`, payload: { stepId, comments: comments || null, digitalSignature: ds } })
        ]);
        try {
          await notifyRequestUpdated(requestId);
        } catch (error) {
          logNotification("error", "Fallo notificacion de rechazo", {
            requestId,
            stepId,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
        return J({ requestId, status: "rejected" });
      }
      const { data: nx } = await supabase.from("request_steps").select("*").eq("request_id", requestId).gt("sequence", Number(cur.sequence)).order("sequence", { ascending: true });
      const next = (nx ?? []).find((x) => x.status === "queued") as Row | undefined;
      if (next) await supabase.from("request_steps").update({ status: "pending" }).eq("id", next.id);
      const status = next ? stepStatus(next) : (decision === "complete" ? "completed" : "approved");
      await Promise.all([supabase.from("requests").update({ status }).eq("id", requestId), supabase.from("request_events").insert({ request_id: requestId, event_type: "STEP_UPDATED", actor_name: actorName, actor_email: actorEmail, notes: `${String(cur.label)} marcado como ${mapped}`, payload: { stepId, decision, comments: comments || null, digitalSignature: ds } })]);
      try {
        await notifyRequestUpdated(requestId);
      } catch (error) {
        logNotification("error", "Fallo notificacion de actualizacion de solicitud", {
          requestId,
          stepId,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
      return J({ requestId, status });
    }

    if (request.method === "GET" && p === "/admins/check") { const e = normEmail(u.searchParams.get("email")); if (!e) return J({ message: "El correo es requerido" }, 400); return J({ isAdmin: await isAdmin(e) }); }
    if (request.method === "GET" && p === "/admins") { await assertAdmin(u.searchParams.get("actorEmail")); const { data, error } = await supabase.from("admin_users").select("*").order("full_name", { ascending: true }); if (error) throw new HttpError(500, "No se pudo cargar administradores"); return J(data ?? []); }
    if (request.method === "GET" && p === "/users/roles") { const e = normEmail(u.searchParams.get("email")); if (!e) return J({ message: "El correo es requerido" }, 400); const { data, error } = await supabase.from("user_roles").select("*").ilike("email", e).order("role_code", { ascending: true }); if (error) throw new HttpError(500, "No se pudo cargar roles"); return J(data ?? []); }
    if (request.method === "GET" && p === "/admin/user-roles") { await assertAdmin(u.searchParams.get("actorEmail")); const { data, error } = await supabase.from("user_roles").select("*").order("full_name", { ascending: true }); if (error) throw new HttpError(500, "No se pudo cargar roles"); return J(data ?? []); }
    if (request.method === "GET" && p === "/admin/catalog-items") { await assertAdmin(u.searchParams.get("actorEmail")); const { data, error } = await supabase.from("catalog_items").select("*").eq("active", true).order("catalog_key", { ascending: true }).order("sort_order", { ascending: true }); if (error) throw new HttpError(500, "No se pudo cargar catalogos"); return J(data ?? []); }
    if (request.method === "GET" && p === "/admin/approvers") { await assertAdmin(u.searchParams.get("actorEmail")); const { data, error } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true }); if (error) throw new HttpError(500, "No se pudo cargar aprobadores"); return J(data ?? []); }
    if (request.method === "GET" && p === "/admin/workflow-steps") { await assertAdmin(u.searchParams.get("actorEmail")); return J(await workflowTemplates(true)); }

    if (request.method === "POST" && p === "/admins") { const b = await body(request) as Row; const actor = await assertAdmin(b.actorEmail); const fullName = String(b.fullName ?? "").trim(), e = normEmail(b.email); if (!fullName || !e) throw new HttpError(400, "Nombre y correo son requeridos"); const { data, error } = await supabase.from("admin_users").upsert({ full_name: fullName, email: e, created_by_email: actor }, { onConflict: "email" }).select("*").single(); if (error) throw new HttpError(500, "No se pudo guardar administrador"); const { data: all } = await supabase.from("admin_users").select("*").order("full_name", { ascending: true }); return J({ created: data, admins: all ?? [] }, 201); }

    if (request.method === "GET" && p === "/admin/mobile-lines") {
      await assertAdmin(u.searchParams.get("actorEmail"));
      const { data: rt } = await supabase.from("request_types").select("id").eq("code", "MOBILE_LINE_REQUEST").maybeSingle();
      if (!rt?.id) return J([]);
      const { data: ok } = await supabase.from("request_steps").select("request_id").eq("role_code", "GG_APPROVAL").eq("status", "approved");
      const ids = Array.from(new Set((ok ?? []).map((x) => String(x.request_id))));
      if (!ids.length) return J([]);
      const { data, error } = await supabase.from("requests").select(reqSel).eq("request_type_id", rt.id).in("id", ids).order("updated_at", { ascending: false });
      if (error) throw new HttpError(500, "No se pudo cargar lineas aprobadas");
      return J((data ?? []).map((r) => flatReq(r as Row)));
    }

    if (request.method === "POST" && p === "/admin/user-roles") {
      const b = await body(request) as Row; const actor = await assertAdmin(b.actorEmail);
      const fullName = String(b.fullName ?? "").trim(), e = normEmail(b.email), roleCode = normCode(b.roleCode);
      if (!fullName || !e || !roleCode) throw new HttpError(400, "Nombre, correo y rol son requeridos");
      const { data, error } = await supabase.from("user_roles").upsert({ full_name: fullName, email: e, role_code: roleCode, created_by_email: actor }, { onConflict: "email,role_code" }).select("*").single();
      if (error) throw new HttpError(500, "No se pudo guardar rol");
      const { data: all } = await supabase.from("user_roles").select("*").order("full_name", { ascending: true });
      return J({ created: data, roles: all ?? [] }, 201);
    }

    if (request.method === "POST" && p === "/admin/catalog-items") {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail);
      const catalogKey = String(b.catalogKey ?? "").trim().toUpperCase(), itemLabel = String(b.itemLabel ?? "").trim(), itemValue = String(b.itemValue ?? "").trim(), sortOrder = Number(b.sortOrder ?? 999);
      if (!catalogKey || !itemLabel || !itemValue) throw new HttpError(400, "Catalogo, etiqueta y valor son requeridos");
      const { data, error } = await supabase.from("catalog_items").upsert({ catalog_key: catalogKey, item_label: itemLabel, item_value: itemValue, sort_order: Number.isFinite(sortOrder) ? sortOrder : 999, active: true }, { onConflict: "catalog_key,item_value" }).select("*").single();
      if (error) throw new HttpError(500, "No se pudo guardar item de catalogo");
      const { data: all } = await supabase.from("catalog_items").select("*").eq("active", true).order("catalog_key", { ascending: true }).order("sort_order", { ascending: true });
      return J({ created: data, items: all ?? [] }, 201);
    }

    if (request.method === "PATCH" && /^\/admin\/catalog-items\/[^/]+$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const { data, error } = await supabase.from("catalog_items").update({ catalog_key: String(b.catalogKey ?? "").trim().toUpperCase(), item_label: String(b.itemLabel ?? "").trim(), item_value: String(b.itemValue ?? "").trim(), sort_order: Number(b.sortOrder ?? 999), active: true }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar catalogo");
      if (!data) throw new HttpError(404, "Catalogo no encontrado");
      const { data: all } = await supabase.from("catalog_items").select("*").eq("active", true).order("catalog_key", { ascending: true }).order("sort_order", { ascending: true });
      return J({ updated: data, items: all ?? [] });
    }

    if (request.method === "POST" && p === "/admin/request-types") {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail);
      const c = normCode(b.code), n = String(b.name ?? "").trim(), d = String(b.description ?? "").trim(), cat = String(b.category ?? "").trim(), tc = String(b.themeColor ?? "").trim();
      if (!c || !n || !d || !cat || !tc) throw new HttpError(400, "Codigo, nombre, descripcion, categoria y color son requeridos");
      const active = await workflowTemplates(false);
      const defaults = active.some((x) => x.code === "AREA_MANAGER") ? ["AREA_MANAGER"] : active.slice(0, 1).map((x) => String(x.code));
      if (!defaults.length) throw new HttpError(400, "Debes tener al menos un paso activo para crear un tipo de solicitud");
      const wf = await workflowDefinition(defaults);
      const { data, error } = await supabase.from("request_types").insert({ code: c, name: n, description: d, category: cat, theme_color: tc, fields: [], workflow: { steps: wf.steps }, requires_general_management: wf.requiresGeneralManagement, active: true }).select("*").single();
      if (error) throw new HttpError(500, "No se pudo crear tipo de solicitud");
      return J({ created: data, requestTypes: await listRequestTypes() }, 201);
    }

    if (request.method === "PATCH" && /^\/admin\/request-types\/[^/]+$/.test(p) && !p.endsWith("/workflow")) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const { data, error } = await supabase.from("request_types").update({ name: String(b.name ?? "").trim(), description: String(b.description ?? "").trim(), category: String(b.category ?? "").trim(), theme_color: String(b.themeColor ?? "").trim() }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar tipo de solicitud");
      if (!data) throw new HttpError(404, "Tipo de solicitud no encontrado");
      return J({ updated: data, requestTypes: await listRequestTypes() });
    }

    if (request.method === "DELETE" && /^\/admin\/request-types\/[^/]+$/.test(p)) {
      await assertAdmin(u.searchParams.get("actorEmail")); const id = p.split("/")[3];
      const { count } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("request_type_id", id);
      if ((count ?? 0) > 0) throw new HttpError(400, "No puedes eliminar este tipo de solicitud porque ya tiene solicitudes registradas");
      const { data, error } = await supabase.from("request_types").delete().eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo eliminar tipo de solicitud");
      if (!data) throw new HttpError(404, "Tipo de solicitud no encontrado");
      return J({ removed: data, requestTypes: await listRequestTypes() });
    }

    if (request.method === "PATCH" && /^\/admin\/request-types\/[^/]+\/workflow$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const wf = await workflowDefinition(Array.isArray(b.stepCodes) ? b.stepCodes.map((x) => String(x)) : []);
      const { data, error } = await supabase.from("request_types").update({ workflow: { steps: wf.steps }, requires_general_management: wf.requiresGeneralManagement }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar workflow");
      if (!data) throw new HttpError(404, "Tipo de solicitud no encontrado");
      return J({ updated: data, requestTypes: await listRequestTypes() });
    }

    if (request.method === "POST" && p === "/admin/workflow-steps") {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail);
      const payload = { code: normCode(b.code), label: String(b.label ?? "").trim(), description: String(b.description ?? "").trim(), kind: String(b.kind ?? ""), routing: String(b.routing ?? ""), scope: String(b.scope ?? "").trim().toUpperCase() || null, sort_order: Number(b.sortOrder ?? 999), active: true };
      if (!payload.code || !payload.label || !payload.description || !payload.kind || !payload.routing) throw new HttpError(400, "Codigo, etiqueta, descripcion, tipo y ruteo son requeridos");
      const { data, error } = await supabase.from("workflow_step_templates").insert(payload).select("*").single();
      if (error) throw new HttpError(500, "No se pudo crear paso");
      return J({ created: data, steps: await workflowTemplates(true) }, 201);
    }

    if (request.method === "PATCH" && /^\/admin\/workflow-steps\/[^/]+$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const { data, error } = await supabase.from("workflow_step_templates").update({ label: String(b.label ?? "").trim(), description: String(b.description ?? "").trim(), active: Boolean(b.active), sort_order: Number(b.sortOrder ?? 999) }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar paso");
      if (!data) throw new HttpError(404, "Paso no encontrado");
      return J({ updated: data, steps: await workflowTemplates(true) });
    }

    if (request.method === "DELETE" && /^\/admin\/workflow-steps\/[^/]+$/.test(p)) {
      await assertAdmin(u.searchParams.get("actorEmail")); const id = p.split("/")[3];
      const { data: cur } = await supabase.from("workflow_step_templates").select("*").eq("id", id).maybeSingle();
      if (!cur) throw new HttpError(404, "Paso no encontrado");
      const { data: rts } = await supabase.from("request_types").select("id,code,workflow");
      for (const rt of rts ?? []) {
        const s = Array.isArray(rt.workflow?.steps) ? rt.workflow.steps : [];
        const f = s.filter((x: Row) => String(x.code ?? "") !== String(cur.code));
        if (f.length !== s.length) {
          if (!f.length) throw new HttpError(400, `No se puede eliminar ${String(cur.code)} porque el workflow ${String(rt.code)} quedaria sin pasos. Agrega otro paso antes de eliminarlo.`);
          await supabase.from("request_types").update({ workflow: { steps: f }, requires_general_management: f.some((x: Row) => String(x.code ?? "") === "GG_APPROVAL") }).eq("id", rt.id);
        }
      }
      await supabase.from("approvers").delete().eq("role_code", cur.code);
      await supabase.from("workflow_step_templates").delete().eq("id", id);
      return J({ steps: await workflowTemplates(true), requestTypes: await listRequestTypes() });
    }

    if (request.method === "POST" && p === "/admin/approvers") {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail);
      const payload = { department: String(b.department ?? "").trim() || null, scope: normCode(b.scope), role_code: normCode(b.roleCode), full_name: String(b.fullName ?? "").trim(), email: normEmail(b.email), title: String(b.title ?? "").trim(), assignment_role: String(b.assignmentRole ?? "PRIMARY").toUpperCase() === "BACKUP" ? "BACKUP" : "PRIMARY", sort_order: Number(b.sortOrder ?? 999) };
      if (!payload.full_name || !payload.email || !payload.title || !payload.scope || !payload.role_code) throw new HttpError(400, "Nombre, correo, cargo, alcance y rol son requeridos");
      const { data, error } = await supabase.from("approvers").insert(payload).select("*").single();
      if (error) throw new HttpError(500, "No se pudo guardar aprobador");
      const { data: all } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true });
      return J({ created: data, approvers: all ?? [] }, 201);
    }

    if (request.method === "PATCH" && /^\/admin\/approvers\/[^/]+$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const { data, error } = await supabase.from("approvers").update({ full_name: String(b.fullName ?? "").trim(), email: normEmail(b.email), title: String(b.title ?? "").trim(), assignment_role: String(b.assignmentRole ?? "PRIMARY").toUpperCase() === "BACKUP" ? "BACKUP" : "PRIMARY" }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar aprobador");
      if (!data) throw new HttpError(404, "Aprobador no encontrado");
      const { data: all } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true });
      return J({ updated: data, approvers: all ?? [] });
    }

    if (request.method === "POST" && /^\/admin\/approvers\/[^/]+\/move$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3]; const direction = String(b.direction ?? "").toLowerCase();
      if (!["up", "down"].includes(direction)) throw new HttpError(400, "La direccion es invalida");
      const { data: cur } = await supabase.from("approvers").select("*").eq("id", id).maybeSingle();
      if (!cur) throw new HttpError(404, "Aprobador no encontrado");
      let q = supabase.from("approvers").select("*").eq("scope", cur.scope).eq("role_code", cur.role_code);
      q = cur.department === null ? q.is("department", null) : q.eq("department", cur.department);
      const { data: group } = await q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      const arr = group ?? []; const i = arr.findIndex((x) => String(x.id) === id); const j = direction === "up" ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < arr.length) await Promise.all([supabase.from("approvers").update({ sort_order: arr[j].sort_order }).eq("id", arr[i].id), supabase.from("approvers").update({ sort_order: arr[i].sort_order }).eq("id", arr[j].id)]);
      const { data: all } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true });
      return J({ updated: cur, approvers: all ?? [] });
    }

    if (request.method === "POST" && /^\/admin\/approvers\/[^/]+\/assignment-role$/.test(p)) {
      const b = await body(request) as Row; await assertAdmin(b.actorEmail); const id = p.split("/")[3];
      const role = String(b.assignmentRole ?? "").toUpperCase() === "BACKUP" ? "BACKUP" : "PRIMARY";
      const { data, error } = await supabase.from("approvers").update({ assignment_role: role }).eq("id", id).select("*").maybeSingle();
      if (error) throw new HttpError(500, "No se pudo actualizar rol de aprobador");
      if (!data) throw new HttpError(404, "Aprobador no encontrado");
      const { data: all } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true });
      return J({ updated: data, approvers: all ?? [] });
    }

    if (request.method === "DELETE" && /^\/admin\/approvers\/[^/]+$/.test(p)) {
      await assertAdmin(u.searchParams.get("actorEmail"));
      await supabase.from("approvers").delete().eq("id", p.split("/")[3]);
      const { data: all } = await supabase.from("approvers").select("*").order("scope", { ascending: true }).order("role_code", { ascending: true }).order("sort_order", { ascending: true });
      return J({ approvers: all ?? [] });
    }

    return J({ message: "Endpoint pendiente de migracion en Supabase API", path: p, method: request.method }, 501);
  } catch (e) {
    if (e instanceof HttpError) return J({ message: e.message }, e.status);
    return J({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
