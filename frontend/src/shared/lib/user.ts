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
    labels.add(roleLabels[userRole.role_code] ?? userRole.role_code);
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

  if (userRoles.some((role) => ["MANAGER", "HR", "GENERAL_MANAGEMENT"].includes(role.role_code))) {
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
  userRoles: UserRoleAssignment[]
): AppUser {
  return {
    name: sessionName ?? email.split("@")[0],
    email,
    isAdmin,
    isApprover: profiles.length > 0,
    canManagePeopleFlows: canManagePeopleFlows(isAdmin, profiles, userRoles),
    roleLabels: buildRoleLabels(isAdmin, profiles, userRoles),
    userRoleCodes: userRoles.map((role) => role.role_code)
  };
}
