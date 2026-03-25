import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { StatusBadge } from "@/src/shared/components/StatusBadge";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getDashboardForActor, getRequests, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [adminCheck, approverProfiles, userRoles, catalog, dashboard, requests, inboxItems] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog(),
    getDashboardForActor(session.user.email),
    getRequests(undefined, session.user.email),
    getApproverInbox(session.user.email)
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles);
  const totalRequests = requests.length;
  const pendingApprovals = inboxItems.length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin={currentUser.isAdmin}
        activeItem="home"
        requestTypes={catalog.requestTypes.filter((type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows)}
        title="SSD | Home"
        subtitle="Portal corporativo para registrar solicitudes, gestionar aprobaciones y mantener trazabilidad operativa desde Pedersen Connect."
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:p-8">
          <div className="inline-flex rounded-full border border-[#9cb8d6] bg-[#eaf6ff] px-4 py-2 text-xs uppercase tracking-[0.32em] text-[#1e3a5f]">
            Sistema de Solicitudes Digital
          </div>
          <h2 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-[#001534] md:text-5xl">
            Un punto central para solicitudes de RRHH, compras, TI y aprobaciones ejecutivas.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#1e3a5f] md:text-lg">
            SSD es la subaplicacion de Pedersen Connect que centraliza solicitudes empresariales, aprobaciones por rol y notificaciones institucionales.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-[#d7e4f2] bg-[#f5faff] p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Solicitudes registradas</div>
              <div className="mt-3 text-3xl font-semibold text-[#001534]">{totalRequests}</div>
            </div>
            <div className="rounded-[1.75rem] border border-[#d7e4f2] bg-[#f5faff] p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Pendientes en tu bandeja</div>
              <div className="mt-3 text-3xl font-semibold text-[#001534]">{pendingApprovals}</div>
            </div>
            <div className="rounded-[1.75rem] border border-[#d7e4f2] bg-[#f5faff] p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Tipos disponibles</div>
              <div className="mt-3 text-3xl font-semibold text-[#001534]">
                {catalog.requestTypes.filter((type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows).length}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalogo"
              className="rounded-full bg-[#1e3a5f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1f406b]"
            >
              Ir al catalogo
            </Link>
            <Link
              href="/inbox"
              className="rounded-full border border-[#bfd2e7] bg-white px-6 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#f5faff]"
            >
              Abrir bandeja
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Tu perfil operativo</div>
          <h2 className="mt-3 text-xl font-semibold text-[#001534]">{currentUser.name}</h2>
          <p className="mt-2 text-sm text-slate-600">{currentUser.email}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(currentUser.roleLabels ?? ["Colaborador"]).map((role) => (
              <span key={role} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                {role}
              </span>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            {currentUser.canManagePeopleFlows
              ? "Tienes acceso a solicitudes sensibles de personal y desvinculacion."
              : "Tu catalogo muestra solo las solicitudes habilitadas para tu perfil actual."}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Catalogo rapido</div>
          <div className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {catalog.requestTypes
              .filter((type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows)
              .map((type) => (
                <Link
                  key={type.code}
                  href={`/solicitudes/${encodeURIComponent(type.code)}`}
                  className="block rounded-[1.5rem] border border-[#d7e4f2] bg-[#f5faff] p-4 transition hover:bg-[#eaf6ff]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-[#001534]">{type.name}</div>
                      <div className="mt-2 text-sm leading-7 text-[#1e3a5f]">{type.description}</div>
                    </div>
                    <div className="h-10 w-1 rounded-full" style={{ backgroundColor: type.theme_color }} />
                  </div>
                </Link>
              ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Ultimas solicitudes</div>
            <Link href="/catalogo" className="text-sm font-medium text-[#1e3a5f]">
              Nueva solicitud
            </Link>
          </div>
          <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
            {requests.slice(0, 10).map((item) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className="block rounded-[1.5rem] border border-[#d7e4f2] bg-[#f5faff] p-4 transition hover:bg-[#eaf6ff]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-500">{item.ticket_code}</div>
                    <div className="mt-1 text-lg font-semibold text-[#001534]">{item.subject}</div>
                    <div className="mt-2 text-sm text-[#1e3a5f]">{item.request_type_name}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Analitica operativa</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.byType.map((item) => (
            <div key={item.name} className="rounded-[1.5rem] border border-[#d7e4f2] bg-[#f5faff] p-4">
              <div className="text-sm font-semibold text-[#001534]">{item.name}</div>
              <div className="mt-2 text-sm text-[#1e3a5f]">{item.total} solicitudes</div>
            </div>
          ))}
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
