import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { StatusBadge } from "@/src/shared/components/StatusBadge";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getRequests, getUserRoles } from "@/src/shared/lib/api";
import { formatDateTimePanama } from "@/src/shared/lib/datetime";
import { buildCurrentUser } from "@/src/shared/lib/user";

function formatDate(value: string) {
  return formatDateTimePanama(value);
}

export default async function MyRequestsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [adminCheck, approverProfiles, userRoles, catalog, inboxItems, myRequests] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog(),
    getApproverInbox(session.user.email),
    getRequests(session.user.email, session.user.email)
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles);
  const visibleTypes = catalog.requestTypes.filter(
    (type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin={currentUser.isAdmin}
        activeItem="my-requests"
        requestTypes={visibleTypes}
        title="SSD | Mis solicitudes"
        subtitle="Consulta el estado de tus tickets, su trazabilidad y el avance del flujo de aprobacion."
      />

      <section className="rounded-[2rem] border border-[#bfd2e7] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Historial personal</div>
            <h2 className="mt-3 text-2xl font-semibold text-[#001534]">Solicitudes registradas por ti</h2>
          </div>
          <Link
            href="/catalogo"
            className="rounded-full bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f406b]"
          >
            Nueva solicitud
          </Link>
        </div>

        {myRequests.length === 0 ? (
          <div className="rounded-[1.8rem] border border-[#d7e4f2] bg-[#f5faff] p-6 text-sm leading-7 text-[#1e3a5f]">
            Aun no has creado solicitudes en SSD.
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map((item) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className="block rounded-[1.7rem] border border-[#d7e4f2] bg-[#f5faff] p-5 transition hover:bg-[#eaf6ff]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.ticket_code}</div>
                    <div className="mt-2 text-xl font-semibold text-[#001534]">{item.subject}</div>
                    <div className="mt-3 text-sm leading-7 text-[#1e3a5f]">
                      {item.request_type_name} | {item.department}
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Registrada: {formatDate(item.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AppFooter />
    </div>
  );
}
