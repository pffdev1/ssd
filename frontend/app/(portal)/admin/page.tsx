import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPanel } from "@/src/features/admin/components/AdminPanel";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import {
  checkAdmin,
  getAdminUsers,
  getApprovedMobileLines,
  getApproverInbox,
  getApproverProfile,
  getCatalog,
  getCatalogItems,
  getWorkflowSteps,
  getUserRoles
} from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [adminCheck, approverProfiles, userRoles, catalog] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog()
  ]);

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const currentUser = buildCurrentUser(session.user.name, session.user.email, true, approverProfiles, userRoles);

  const [admins, approvedMobileLines, inboxItems, catalogItems, stepTemplates] = await Promise.all([
    getAdminUsers(currentUser.email),
    getApprovedMobileLines(currentUser.email),
    getApproverInbox(currentUser.email),
    getCatalogItems(currentUser.email),
    getWorkflowSteps(currentUser.email)
  ]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin
        activeItem="admin"
        requestTypes={catalog.requestTypes}
        title="SSD | Administracion"
        subtitle="Gestiona administradores, planes celulares y catalogos editables del Sistema de Solicitudes Digital."
      />
      <AdminPanel
        currentUser={currentUser}
        admins={admins}
        approvedMobileLines={approvedMobileLines}
        catalogItems={catalogItems}
        requestTypes={catalog.requestTypes}
        stepTemplates={stepTemplates}
      />
      <AppFooter />
    </div>
  );
}
