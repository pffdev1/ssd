import * as React from "react";
import RequestNotificationEmail, { RequestNotificationRow } from "../RequestNotificationEmail";

export interface RequestCreatedEmailProps {
  previewText: string;
  greetingName: string;
  statusLabel: string;
  statusDetail: string;
  summaryRows: RequestNotificationRow[];
  detailRows: RequestNotificationRow[];
  actionUrl: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
}

export function RequestCreatedEmail({
  previewText,
  greetingName,
  statusLabel,
  statusDetail,
  summaryRows,
  detailRows,
  actionUrl,
  brandLogoSrc,
  brandLogoAlt
}: RequestCreatedEmailProps) {
  return (
    <RequestNotificationEmail
      previewText={previewText}
      tone="info"
      categoryLabel="Registro"
      title="Solicitud registrada"
      subtitle="Tu solicitud ya fue recibida por el Sistema de Solicitudes Digital."
      greetingName={greetingName}
      introText="Tu solicitud fue registrada correctamente y ya entro al flujo de aprobacion corporativo."
      statusLabel={statusLabel}
      statusDetail={statusDetail}
      summaryHeading="Registro inicial"
      summaryRows={summaryRows}
      detailHeading="Resumen de la solicitud"
      detailRows={detailRows}
      actionLabel="Ver solicitud"
      actionUrl={actionUrl}
      brandLogoSrc={brandLogoSrc}
      brandLogoAlt={brandLogoAlt}
    />
  );
}

export default RequestCreatedEmail;
