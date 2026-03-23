import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApproverInbox } from "@/src/features/approvals/components/ApproverInbox";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

export default async function InboxPage() {
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
        activeItem="inbox"
        requestTypes={visibleTypes}
        title="SSD | Bandeja de aprobaciones"
        subtitle="Cada aprobador ve aqui las solicitudes pendientes asignadas a su correo corporativo desde Microsoft Entra."
      />
      <ApproverInbox user={currentUser} items={inboxItems} />
      <AppFooter />
    </div>
  );
}
