import * as React from "react";
import RequestNotificationEmail, { RequestNotificationRow } from "../RequestNotificationEmail";

export interface ApproverPendingEmailProps {
  previewText: string;
  categoryLabel: string;
  subtitle: string;
  greetingName: string;
  introText: string;
  statusDetail: string;
  summaryRows: RequestNotificationRow[];
  detailRows: RequestNotificationRow[];
  formRows: RequestNotificationRow[];
  actionUrl: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
}

export function ApproverPendingEmail({
  previewText,
  categoryLabel,
  subtitle,
  greetingName,
  introText,
  statusDetail,
  summaryRows,
  detailRows,
  formRows,
  actionUrl,
  brandLogoSrc,
  brandLogoAlt
}: ApproverPendingEmailProps) {
  return (
    <RequestNotificationEmail
      previewText={previewText}
      tone="action"
      categoryLabel={categoryLabel}
      title="Accion requerida en SSD"
      subtitle={subtitle}
      greetingName={greetingName}
      introText={introText}
      statusLabel="Pendiente de accion"
      statusDetail={statusDetail}
      summaryHeading="Tu intervencion"
      summaryRows={summaryRows}
      detailHeading="Resumen de la solicitud"
      detailRows={detailRows}
      formHeading="Resumen del formulario"
      formRows={formRows}
      actionLabel="Abrir bandeja"
      actionUrl={actionUrl}
      brandLogoSrc={brandLogoSrc}
      brandLogoAlt={brandLogoAlt}
    />
  );
}

export default ApproverPendingEmail;
