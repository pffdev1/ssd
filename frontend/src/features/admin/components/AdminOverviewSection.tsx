"use client";

import { AdminSectionId } from "@/src/features/admin/lib/config";

function OverviewCard({
  label,
  value,
  detail,
  actionLabel,
  onAction
}: {
  label: string;
  value: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">{label}</div>
      <div className="mt-4 text-4xl font-semibold text-[#001534]">{value}</div>
      <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">{detail}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-full border border-[#bfd2e7] bg-[#f5faff] px-4 py-2 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eaf3ff]"
      >
        {actionLabel}
      </button>
    </article>
  );
}

export function AdminOverviewSection({
  adminCount,
  routeCount,
  departmentCount,
  requestTypeCount,
  approvedMobileLineCount,
  onNavigate
}: {
  adminCount: number;
  routeCount: number;
  departmentCount: number;
  requestTypeCount: number;
  approvedMobileLineCount: number;
  onNavigate: (section: AdminSectionId) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[#bfd2e7] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(234,246,255,0.96)_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] lg:p-8">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Centro de administracion</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#001534]">Control operativo de SSD</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#1e3a5f]">
          Usa este panel para mantener el organigrama, los responsables, los workflows, los catalogos y la administracion general desde un solo punto.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-4">
        <OverviewCard
          label="Responsables"
          value={String(routeCount)}
          detail={`SSD tiene ${routeCount} rutas operativas configuradas y ahora se gestionan directamente desde Departamentos.`}
          actionLabel="Ver departamentos"
          onAction={() => onNavigate("departments")}
        />
        <OverviewCard
          label="Departamentos"
          value={String(departmentCount)}
          detail={`Hay ${departmentCount} departamentos oficiales publicados en el organigrama operativo con sus responsables asociados.`}
          actionLabel="Ver organigrama"
          onAction={() => onNavigate("departments")}
        />
        <OverviewCard
          label="Catalogos"
          value={String(requestTypeCount)}
          detail={`Hay ${requestTypeCount} tipos de solicitud activos con parametros administrables.`}
          actionLabel="Ir a Catalogos"
          onAction={() => onNavigate("catalogs")}
        />
        <OverviewCard
          label="Control"
          value={String(adminCount)}
          detail={`Actualmente hay ${adminCount} administradores y ${approvedMobileLineCount} lineas aprobadas con seguimiento operativo.`}
          actionLabel="Ir a Administracion"
          onAction={() => onNavigate("admins")}
        />
      </div>
    </section>
  );
}
