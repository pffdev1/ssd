import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { render } from "@react-email/render";
import RequestNotificationEmail from "./templates/RequestNotificationEmail";

function getEmbeddedLogoSrc() {
  const assetPath = resolve(process.cwd(), "assets", "brand", "pedersen-connect-logo.png");
  const buffer = readFileSync(assetPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function main() {
  const outputDir = resolve(process.cwd(), ".email-preview");
  mkdirSync(outputDir, { recursive: true });

  const logoSrc = getEmbeddedLogoSrc();

  const previews = [
    {
      fileName: "request-registered.html",
      element: (
        <RequestNotificationEmail
          previewText="Solicitud registrada SSD-2026-00010"
          tone="info"
          categoryLabel="Registro"
          brandLogoSrc={logoSrc}
          title="Solicitud registrada"
          subtitle="Tu solicitud ya fue recibida por el Sistema de Solicitudes Digital."
          greetingName="Weelmer Moreno"
          introText="Tu solicitud fue registrada correctamente y ya entro al flujo de aprobacion corporativo."
          statusLabel="Pendiente"
          statusDetail="SSD registro tu solicitud y la envio al primer responsable disponible."
          summaryHeading="Registro inicial"
          summaryRows={[
            { label: "Ticket", value: "SSD-2026-00010" },
            { label: "Tipo", value: "Solicitud de vacaciones" },
            { label: "Departamento", value: "Proyectos / IT" },
            { label: "Primer responsable", value: "Gabriela Santos (Jefatura inmediata)" }
          ]}
          detailHeading="Resumen de la solicitud"
          detailRows={[
            { label: "Solicitante", value: "Weelmer Moreno (weelmer.moreno@pffsa.com)" },
            { label: "Asunto", value: "Permiso personal" },
            { label: "Colaborador", value: "Weelmer Moreno" },
            { label: "Fecha de inicio", value: "23 mar 2026, 08:00 a. m." },
            { label: "Fecha de fin", value: "23 mar 2026, 05:00 p. m." }
          ]}
          actionLabel="Ver solicitud"
          actionUrl="https://ssd.pffsa.com/requests/demo"
        />
      )
    },
    {
      fileName: "approver-pending.html",
      element: (
        <RequestNotificationEmail
          previewText="Accion requerida SSD-2026-00010"
          tone="action"
          categoryLabel="Aprobacion"
          brandLogoSrc={logoSrc}
          title="Accion requerida en SSD"
          subtitle="Tienes una solicitud pendiente por aprobar."
          greetingName="Gabriela Santos"
          introText="Se te asigno una solicitud en el paso Jefatura inmediata."
          statusLabel="Pendiente de accion"
          statusDetail="Jefatura inmediata requiere tu aprobacion en SSD."
          summaryHeading="Tu intervencion"
          summaryRows={[
            { label: "Paso asignado", value: "Jefatura inmediata" },
            { label: "Solicitante", value: "Weelmer Moreno" },
            { label: "Departamento", value: "Proyectos / IT" },
            { label: "Tipo de accion", value: "Aprobacion requerida" }
          ]}
          detailHeading="Resumen de la solicitud"
          detailRows={[
            { label: "Ticket", value: "SSD-2026-00010" },
            { label: "Tipo", value: "Solicitud de vacaciones" },
            { label: "Asunto", value: "Permiso personal" },
            { label: "Justificacion", value: "Cita medica familiar" }
          ]}
          formHeading="Resumen del formulario"
          formRows={[
            { label: "Colaborador", value: "Weelmer Moreno" },
            { label: "Tipo de ausencia", value: "Permiso personal" },
            { label: "Fecha de inicio", value: "23 mar 2026, 08:00 a. m." },
            { label: "Fecha de fin", value: "23 mar 2026, 05:00 p. m." }
          ]}
          actionLabel="Abrir bandeja"
          actionUrl="https://ssd.pffsa.com/inbox"
        />
      )
    }
  ];

  for (const preview of previews) {
    const html = await render(preview.element);
    writeFileSync(resolve(outputDir, preview.fileName), html, "utf8");
  }

  console.info(`React Email previews generated in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
