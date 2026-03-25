import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

function displayValue(value?: string | null) {
  return value && value.trim() ? value : "No disponible";
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [adminCheck, approverProfiles, userRoles, catalog, inboxItems] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog(),
    getApproverInbox(session.user.email)
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles, {
    companyName: session.user.companyName,
    department: session.user.department,
    jobTitle: session.user.jobTitle,
    employeeId: session.user.employeeId,
    employeeType: session.user.employeeType,
    employeeHireDate: session.user.employeeHireDate,
    officeLocation: session.user.officeLocation,
    managerEmail: session.user.managerEmail,
    managerName: session.user.managerName,
    managerTitle: session.user.managerTitle,
    sponsors: session.user.sponsors
  });
  const visibleTypes = catalog.requestTypes.filter(
    (type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin={currentUser.isAdmin}
        activeItem="profile"
        requestTypes={visibleTypes}
        title="SSD | Perfil"
        subtitle="Consulta tu identidad corporativa, roles detectados y el alcance operativo habilitado dentro de SSD."
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#8e1730]">Identidad</div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{currentUser.name}</h2>
          <p className="mt-2 text-sm text-slate-600">{currentUser.email}</p>

          <div className="mt-6 space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Administrador</div>
              <div className="mt-2 text-base font-semibold text-slate-950">{currentUser.isAdmin ? "Si" : "No"}</div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Aprobador</div>
              <div className="mt-2 text-base font-semibold text-slate-950">{currentUser.isApprover ? "Si" : "No"}</div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Acceso a personal y desvinculacion</div>
              <div className="mt-2 text-base font-semibold text-slate-950">
                {currentUser.canManagePeopleFlows ? "Habilitado" : "Restringido"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-[#8e1730]">Informacion del trabajo</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Puesto</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{displayValue(currentUser.jobTitle)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Unidad de negocio</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{displayValue(currentUser.companyName)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Departamento</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{displayValue(currentUser.department)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ubicacion</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{displayValue(currentUser.officeLocation)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Jefe/Supervisor Directo</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {currentUser.managerName || currentUser.managerEmail
                  ? `${currentUser.managerName ?? "Jefatura directa"}${currentUser.managerEmail ? ` | ${currentUser.managerEmail}` : ""}`
                  : "No disponible"}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-8">
          <div className="text-xs uppercase tracking-[0.24em] text-[#8e1730]">Roles detectados</div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(currentUser.roleLabels ?? ["Colaborador"]).map((role) => (
              <span key={role} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                {role}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <div className="text-sm font-semibold text-slate-950">Perfiles de aprobacion</div>
            <div className="mt-4 space-y-4">
              {approverProfiles.length === 0 ? (
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No tienes perfiles de aprobacion configurados en SSD.
                </div>
              ) : (
                approverProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-base font-semibold text-slate-950">{profile.title}</div>
                    <div className="mt-2 text-sm text-slate-600">
                      {profile.department ?? profile.scope} | {profile.role_code}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
