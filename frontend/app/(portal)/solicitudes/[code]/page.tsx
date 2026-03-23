import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { RequestWorkspace } from "@/src/features/requests/components/RequestWorkspace";
import { AppFooter } from "@/src/shared/components/AppFooter";
import { AppHeader } from "@/src/shared/components/AppHeader";
import { checkAdmin, getApproverInbox, getApproverProfile, getCatalog, getRequests, getUserRoles } from "@/src/shared/lib/api";
import { buildCurrentUser } from "@/src/shared/lib/user";

export default async function RequestTypePage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const { code } = await params;
  const [adminCheck, approverProfiles, userRoles, catalog, requests, inboxItems] = await Promise.all([
    checkAdmin(session.user.email),
    getApproverProfile(session.user.email),
    getUserRoles(session.user.email),
    getCatalog(),
    getRequests(undefined, session.user.email),
    getApproverInbox(session.user.email)
  ]);

  const currentUser = buildCurrentUser(session.user.name, session.user.email, adminCheck.isAdmin, approverProfiles, userRoles);
  const visibleTypes = catalog.requestTypes.filter(
    (type) => !["PERSONNEL_REQUEST", "TERMINATION_REQUEST"].includes(type.code) || currentUser.canManagePeopleFlows
  );
  const selectedType = visibleTypes.find((type) => type.code === code);

  if (!selectedType) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-4 py-5 lg:px-8 lg:py-8">
      <AppHeader
        user={currentUser}
        inboxCount={inboxItems.length}
        isAdmin={currentUser.isAdmin}
        activeItem="catalog"
        requestTypes={visibleTypes}
        title={`SSD | ${selectedType.name}`}
        subtitle="Flujo individual de solicitud con formulario, aprobaciones y trazabilidad orientados al tipo seleccionado."
      />
      <RequestWorkspace
        catalog={{
          ...catalog,
          requestTypes: [selectedType]
        }}
        requests={requests}
        currentUser={currentUser}
        initialTypeCode={selectedType.code}
      />
      <AppFooter />
    </div>
  );
}
