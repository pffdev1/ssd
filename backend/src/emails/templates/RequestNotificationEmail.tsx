import * as React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset
} from "@react-email/components";

export type RequestNotificationTone = "info" | "action" | "success" | "danger" | "admin";

export type RequestNotificationRow = {
  label: string;
  value: string;
};

export type RequestNotificationLink = {
  label: string;
  href: string;
};

export type RequestNotificationSignature = {
  signatureId: string;
  signerName: string;
  signedAt: string;
};

export interface RequestNotificationEmailProps {
  previewText: string;
  tone: RequestNotificationTone;
  categoryLabel: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
  title: string;
  subtitle?: string;
  greetingName: string;
  introText: string;
  statusLabel?: string;
  statusDetail?: string;
  summaryHeading: string;
  summaryRows: RequestNotificationRow[];
  detailHeading?: string;
  detailRows?: RequestNotificationRow[];
  formHeading?: string;
  formRows?: RequestNotificationRow[];
  linksHeading?: string;
  links?: RequestNotificationLink[];
  signature?: RequestNotificationSignature;
  actionLabel?: string;
  actionUrl?: string;
}

const toneMap: Record<
  RequestNotificationTone,
  {
    eyebrow: string;
    containerFrom: string;
    containerTo: string;
    panelBackground: string;
    panelBorder: string;
    badgeBackground: string;
    badgeText: string;
    buttonBackground: string;
    buttonBorder: string;
    buttonText: string;
    statusBackground: string;
    statusBorder: string;
  }
> = {
  info: {
    eyebrow: "Comunicacion SSD",
    containerFrom: "#f8fbff",
    containerTo: "#eef5fc",
    panelBackground: "#ffffff",
    panelBorder: "#d7e4f2",
    badgeBackground: "#1f406b",
    badgeText: "#ffffff",
    buttonBackground: "#1f406b",
    buttonBorder: "#1f406b",
    buttonText: "#ffffff",
    statusBackground: "#eef4ff",
    statusBorder: "#bfdbfe"
  },
  action: {
    eyebrow: "Accion requerida",
    containerFrom: "#eef4ff",
    containerTo: "#dfeeff",
    panelBackground: "#f7fbff",
    panelBorder: "#bfd2e7",
    badgeBackground: "#0b5ed7",
    badgeText: "#ffffff",
    buttonBackground: "#0b5ed7",
    buttonBorder: "#0b5ed7",
    buttonText: "#ffffff",
    statusBackground: "#eef4ff",
    statusBorder: "#bfdbfe"
  },
  success: {
    eyebrow: "Proceso completado",
    containerFrom: "#edfdf3",
    containerTo: "#dff7e8",
    panelBackground: "#f7fff9",
    panelBorder: "#b7ebc6",
    badgeBackground: "#067647",
    badgeText: "#ffffff",
    buttonBackground: "#067647",
    buttonBorder: "#067647",
    buttonText: "#ffffff",
    statusBackground: "#edfdf3",
    statusBorder: "#b7ebc6"
  },
  danger: {
    eyebrow: "Atencion",
    containerFrom: "#fff4f3",
    containerTo: "#ffe3e0",
    panelBackground: "#fff8f8",
    panelBorder: "#fecaca",
    badgeBackground: "#b42318",
    badgeText: "#ffffff",
    buttonBackground: "#b42318",
    buttonBorder: "#b42318",
    buttonText: "#ffffff",
    statusBackground: "#fff1f1",
    statusBorder: "#fecaca"
  },
  admin: {
    eyebrow: "Gestion administrativa",
    containerFrom: "#f3f0ff",
    containerTo: "#e8e0ff",
    panelBackground: "#fbfaff",
    panelBorder: "#d9ccff",
    badgeBackground: "#6941c6",
    badgeText: "#ffffff",
    buttonBackground: "#6941c6",
    buttonBorder: "#6941c6",
    buttonText: "#ffffff",
    statusBackground: "#f3f0ff",
    statusBorder: "#d9ccff"
  }
};

function DataRows({ rows }: { rows: RequestNotificationRow[] }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.label}-${row.value}`}>
            <td style={{ padding: "7px 0", width: "180px", fontSize: "13px", color: "#46607d", fontWeight: 600 }}>{row.label}</td>
            <td style={{ padding: "7px 0", fontSize: "14px", color: "#001534", lineHeight: 1.6 }}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DataTable({ rows }: { rows: RequestNotificationRow[] }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.label}-${row.value}`}>
            <td
              style={{
                border: "1px solid #d7e4f2",
                backgroundColor: "#f8fbff",
                padding: "10px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#001534",
                verticalAlign: "top"
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                border: "1px solid #d7e4f2",
                backgroundColor: "#ffffff",
                padding: "10px",
                fontSize: "13px",
                color: "#1e3a5f",
                lineHeight: 1.6
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RequestNotificationEmail({
  previewText,
  tone,
  categoryLabel,
  brandLogoSrc = "cid:pedersen-connect-logo@ssd",
  brandLogoAlt = "Pedersen Connect",
  title,
  subtitle,
  greetingName,
  introText,
  statusLabel,
  statusDetail,
  summaryHeading,
  summaryRows,
  detailHeading,
  detailRows,
  formHeading,
  formRows,
  linksHeading,
  links,
  signature,
  actionLabel,
  actionUrl
}: RequestNotificationEmailProps) {
  const palette = toneMap[tone];

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset]
        }}
      >
        <Body className="mx-auto my-auto bg-[#f3f7fc] px-[12px] py-[24px] font-sans text-[#1e3a5f]">
          <Container className="mx-auto max-w-[760px] overflow-hidden rounded-[28px] border border-solid border-[#bfd2e7] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <Section
              className="border-0 border-b border-solid p-[28px]"
              style={{
                borderBottomColor: palette.panelBorder,
                backgroundImage: `linear-gradient(180deg, ${palette.containerFrom} 0%, ${palette.containerTo} 100%)`
              }}
            >
              <Row>
                <Column width="88">
                  <Section className="h-[72px] w-[72px] rounded-[20px] border border-solid border-[#d7e4f2] bg-white p-[4px]">
                    <Img src={brandLogoSrc} width="64" height="64" alt={brandLogoAlt} className="m-0 h-[64px] w-[64px] object-contain" />
                  </Section>
                </Column>
                <Column>
                  <Text className="m-0 text-[11px] font-bold uppercase tracking-[0.26em] text-[#1f406b]">Pedersen Connect</Text>
                  <Heading className="m-0 mt-[6px] text-[24px] font-bold leading-[1.2] text-[#001534]">Sistema de Solicitudes Digital</Heading>
                  <Text className="m-0 mt-[8px] text-[13px] leading-[1.6] text-[#46607d]">Pedersen Fine Foods | Departamento de Tecnologia e Innovacion</Text>
                </Column>
                <Column align="right" width="220">
                  <Section
                    className="inline-block rounded-[20px] border border-solid px-[16px] py-[14px]"
                    style={{ borderColor: palette.panelBorder, backgroundColor: palette.panelBackground }}
                  >
                    <Text className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">Comunicacion oficial</Text>
                    <Text className="m-0 mt-[6px] text-[14px] leading-[1.6] text-[#1e3a5f]">Flujo documental corporativo SSD</Text>
                  </Section>
                </Column>
              </Row>

              <Section
                className="mt-[22px] rounded-[24px] border border-solid px-[22px] py-[20px]"
                style={{ borderColor: palette.panelBorder, backgroundColor: palette.panelBackground }}
              >
                <Row>
                  <Column>
                    <Text className="m-0 text-[11px] font-bold uppercase tracking-[0.24em] text-[#1f406b]">{palette.eyebrow}</Text>
                  </Column>
                  <Column align="right">
                    <Text
                      className="m-0 inline-block rounded-full px-[12px] py-[6px] text-[11px] font-bold uppercase tracking-[0.08em]"
                      style={{ backgroundColor: palette.badgeBackground, color: palette.badgeText }}
                    >
                      {categoryLabel}
                    </Text>
                  </Column>
                </Row>
                <Heading className="m-0 mt-[10px] text-[28px] font-bold leading-[1.18] text-[#001534]">{title}</Heading>
                {subtitle ? <Text className="m-0 mt-[12px] text-[14px] leading-[1.7] text-[#1e3a5f]">{subtitle}</Text> : null}
              </Section>
            </Section>

            <Section className="px-[28px] py-[28px]">
              <Text className="m-0 text-[14px] leading-[24px] text-[#1e3a5f]">Hola {greetingName},</Text>
              <Text className="m-0 mt-[12px] text-[14px] leading-[24px] text-[#1e3a5f]">{introText}</Text>

              {statusLabel ? (
                <Section
                  className="mt-[18px] rounded-[18px] border border-solid px-[18px] py-[16px]"
                  style={{ borderColor: palette.statusBorder, backgroundColor: palette.statusBackground }}
                >
                  <Text className="m-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">Estado actual</Text>
                  <Text
                    className="m-0 mt-[10px] inline-block rounded-full px-[12px] py-[7px] text-[12px] font-bold uppercase tracking-[0.08em]"
                    style={{ backgroundColor: palette.badgeBackground, color: palette.badgeText }}
                  >
                    {statusLabel}
                  </Text>
                  {statusDetail ? <Text className="m-0 mt-[10px] text-[14px] leading-[24px] text-[#0f172a]">{statusDetail}</Text> : null}
                </Section>
              ) : null}

              <Section className="mt-[18px] rounded-[18px] border border-solid border-[#d7e4f2] bg-[#f9fbff] px-[18px] py-[18px]">
                <Text className="m-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">{summaryHeading}</Text>
                <Section className="mt-[12px]">
                  <DataRows rows={summaryRows} />
                </Section>
              </Section>

              {detailHeading && detailRows && detailRows.length > 0 ? (
                <Section className="mt-[18px] rounded-[18px] border border-solid border-[#d7e4f2] bg-[#ffffff] px-[18px] py-[18px]">
                  <Text className="m-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">{detailHeading}</Text>
                  <Section className="mt-[12px]">
                    <DataTable rows={detailRows} />
                  </Section>
                </Section>
              ) : null}

              {formHeading && formRows && formRows.length > 0 ? (
                <Section className="mt-[18px] rounded-[18px] border border-solid border-[#d7e4f2] bg-[#ffffff] px-[18px] py-[18px]">
                  <Text className="m-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">{formHeading}</Text>
                  <Section className="mt-[12px]">
                    <DataTable rows={formRows} />
                  </Section>
                </Section>
              ) : null}

              {linksHeading && links && links.length > 0 ? (
                <Section className="mt-[18px] rounded-[18px] border border-solid border-[#d7e4f2] bg-[#ffffff] px-[18px] py-[18px]">
                  <Text className="m-0 text-[12px] font-bold uppercase tracking-[0.18em] text-[#1f406b]">{linksHeading}</Text>
                  <Section className="mt-[12px]">
                    {links.map((link) => (
                      <Text key={`${link.label}-${link.href}`} className="m-0 mb-[8px] text-[14px] leading-[24px]">
                        <Link href={link.href} className="text-[#0b5ed7] no-underline">
                          {link.label}
                        </Link>
                      </Text>
                    ))}
                  </Section>
                </Section>
              ) : null}

              {signature ? (
                <Section className="mt-[18px] rounded-[16px] border border-solid border-[#d7e4f2] bg-[#f8fbff] px-[16px] py-[16px]">
                  <Text className="m-0 text-[14px] font-bold text-[#001534]">Firma digital SSD</Text>
                  <Text className="m-0 mt-[8px] text-[14px] leading-[24px] text-[#1e3a5f]">
                    <strong>Codigo:</strong> {signature.signatureId}
                  </Text>
                  <Text className="m-0 text-[14px] leading-[24px] text-[#1e3a5f]">
                    <strong>Firmante:</strong> {signature.signerName}
                  </Text>
                  <Text className="m-0 text-[14px] leading-[24px] text-[#1e3a5f]">
                    <strong>Fecha y hora:</strong> {signature.signedAt}
                  </Text>
                </Section>
              ) : null}

              {actionLabel && actionUrl ? (
                <Section className="mt-[24px] text-center">
                  <Button
                    href={actionUrl}
                    className="rounded-full border border-solid px-[22px] py-[13px] text-center text-[13px] font-bold no-underline"
                    style={{
                      backgroundColor: palette.buttonBackground,
                      borderColor: palette.buttonBorder,
                      color: palette.buttonText
                    }}
                  >
                    {actionLabel}
                  </Button>
                </Section>
              ) : null}

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#d7e4f2]" />
              <Text className="m-0 text-[12px] leading-[22px] text-[#46607d]">
                Pedersen Fine Foods | Departamento de Tecnologia e Innovacion | Mensaje generado automaticamente por SSD
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default RequestNotificationEmail;
