import * as React from "react";
import RequestNotificationEmail, { RequestNotificationLink, RequestNotificationRow } from "../RequestNotificationEmail";

export interface MobileLineAdminReadyEmailProps {
  previewText: string;
  summaryRows: RequestNotificationRow[];
  detailRows: RequestNotificationRow[];
  links: RequestNotificationLink[];
  actionUrl: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
}

export function MobileLineAdminReadyEmail({
  previewText,
  summaryRows,
  detailRows,
  links,
  actionUrl,
  brandLogoSrc,
  brandLogoAlt
}: MobileLineAdminReadyEmailProps) {
  return (
    <RequestNotificationEmail
      previewText={previewText}
      tone="admin"
      categoryLabel="Administracion"
      title="Linea celular aprobada por Gerencia General"
      subtitle="La solicitud ya puede ser atendida administrativamente y sus cartas responsivas estan disponibles."
      greetingName="equipo administrador"
      introText="La solicitud de linea celular fue aprobada y requiere seguimiento administrativo."
      statusLabel="Aprobada por GG"
      statusDetail="La solicitud paso la aprobacion ejecutiva y ya puede avanzar a la atencion administrativa."
      summaryHeading="Seguimiento administrativo"
      summaryRows={summaryRows}
      detailHeading="Detalle de la solicitud"
      detailRows={detailRows}
      linksHeading="Cartas responsivas por beneficiario"
      links={links}
      actionLabel="Abrir solicitud"
      actionUrl={actionUrl}
      brandLogoSrc={brandLogoSrc}
      brandLogoAlt={brandLogoAlt}
    />
  );
}

export default MobileLineAdminReadyEmail;
