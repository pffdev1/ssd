import { ApproverProfile, AppUser, UserRoleAssignment } from "./types";

const roleLabels: Record<string, string> = {
  MANAGER: "Jefe / Gerencia",
  HR: "RRHH",
  IT: "Tecnologia",
  FINANCE: "Finanzas",
  GENERAL_MANAGEMENT: "Gerencia General"
};

export function buildRoleLabels(isAdmin: boolean, profiles: ApproverProfile[], userRoles: UserRoleAssignment[]) {
  const labels = new Set<string>();

  if (isAdmin) {
    labels.add("Administrador SSD");
  }

  for (const userRole of userRoles) {
    const roleCode = String(userRole.role_code ?? "").trim().toUpperCase();
    if (!roleCode) {
      continue;
    }
    labels.add(roleLabels[roleCode] ?? roleCode);
  }

  for (const profile of profiles) {
    if (profile.scope === "AREA") {
      labels.add("Aprobador de area");
    }

    if (profile.scope === "HR") {
      labels.add("RRHH");
    }

    if (profile.scope === "IT") {
      labels.add("Tecnologia");
    }

    if (profile.scope === "GG") {
      labels.add("Gerencia General");
    }

    if (profile.scope === "FINANCE") {
      labels.add("Finanzas");
    }
  }

  return Array.from(labels);
}

export function canManagePeopleFlows(isAdmin: boolean, profiles: ApproverProfile[], userRoles: UserRoleAssignment[]) {
  if (isAdmin) {
    return true;
  }

  if (
    userRoles.some((role) =>
      ["MANAGER", "HR", "GENERAL_MANAGEMENT"].includes(String(role.role_code ?? "").trim().toUpperCase())
    )
  ) {
    return true;
  }

  return profiles.some((profile) => {
    const title = profile.title.toLowerCase();
    return (
      profile.scope === "HR" ||
      profile.department === "Recursos Humanos" ||
      profile.role_code === "AREA_MANAGER" ||
      title.includes("gerente") ||
      title.includes("gerencia") ||
      title.includes("jefe") ||
      title.includes("director") ||
      title.includes("directora")
    );
  });
}

export function buildCurrentUser(
  sessionName: string | null | undefined,
  email: string,
  isAdmin: boolean,
  profiles: ApproverProfile[],
  userRoles: UserRoleAssignment[],
  directory?: {
    companyName?: string;
    department?: string;
    jobTitle?: string;
    employeeId?: string;
    employeeType?: string;
    employeeHireDate?: string;
    officeLocation?: string;
    managerEmail?: string;
    managerName?: string;
    managerTitle?: string;
    sponsors?: string[];
  }
): AppUser {
  return {
    name: sessionName ?? email.split("@")[0],
    email,
    companyName: directory?.companyName,
    department: directory?.department,
    jobTitle: directory?.jobTitle,
    employeeId: directory?.employeeId,
    employeeType: directory?.employeeType,
    employeeHireDate: directory?.employeeHireDate,
    officeLocation: directory?.officeLocation,
    managerEmail: directory?.managerEmail,
    managerName: directory?.managerName,
    managerTitle: directory?.managerTitle,
    sponsors: directory?.sponsors,
    isAdmin,
    isApprover: profiles.length > 0,
    canManagePeopleFlows: canManagePeopleFlows(isAdmin, profiles, userRoles),
    roleLabels: buildRoleLabels(isAdmin, profiles, userRoles),
    userRoleCodes: userRoles.map((role) => role.role_code)
  };
}
