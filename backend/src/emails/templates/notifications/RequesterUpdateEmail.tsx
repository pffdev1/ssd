import * as React from "react";
import RequestNotificationEmail, {
  RequestNotificationRow,
  RequestNotificationSignature,
  RequestNotificationTone
} from "../RequestNotificationEmail";

export interface RequesterUpdateEmailProps {
  previewText: string;
  tone: RequestNotificationTone;
  categoryLabel: string;
  title: string;
  subtitle: string;
  greetingName: string;
  introText: string;
  statusLabel: string;
  statusDetail: string;
  summaryHeading: string;
  summaryRows: RequestNotificationRow[];
  detailRows: RequestNotificationRow[];
  signature?: RequestNotificationSignature;
  actionUrl: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
}

export function RequesterUpdateEmail({
  previewText,
  tone,
  categoryLabel,
  title,
  subtitle,
  greetingName,
  introText,
  statusLabel,
  statusDetail,
  summaryHeading,
  summaryRows,
  detailRows,
  signature,
  actionUrl,
  brandLogoSrc,
  brandLogoAlt
}: RequesterUpdateEmailProps) {
  return (
    <RequestNotificationEmail
      previewText={previewText}
      tone={tone}
      categoryLabel={categoryLabel}
      title={title}
      subtitle={subtitle}
      greetingName={greetingName}
      introText={introText}
      statusLabel={statusLabel}
      statusDetail={statusDetail}
      summaryHeading={summaryHeading}
      summaryRows={summaryRows}
      detailHeading="Detalle de la solicitud"
      detailRows={detailRows}
      signature={signature}
      actionLabel="Ver detalle"
      actionUrl={actionUrl}
      brandLogoSrc={brandLogoSrc}
      brandLogoAlt={brandLogoAlt}
    />
  );
}

export default RequesterUpdateEmail;
