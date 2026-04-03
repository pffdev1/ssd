import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/src/lib/supabase";
import { checkAdmin } from "@/src/lib/api";

type SessionUser = {
  id: string;
  name: string;
  email: string;
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
};

type SessionContextValue = {
  isLoading: boolean;
  isAdmin: boolean;
  user: SessionUser | null;
  authError: string | null;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
};

type DirectoryProfile = {
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
};

type GraphProfile = {
  companyName?: string;
  department?: string;
  jobTitle?: string;
  employeeId?: string;
  employeeType?: string;
  employeeHireDate?: string;
  officeLocation?: string;
};

type GraphManager = {
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
};

type GraphSponsorItem = {
  displayName?: string | null;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function normalizeEmail(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
}

function readStringValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readStringList(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      const parsed = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);

      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readNestedManager(metadata: Record<string, unknown>) {
  const manager = metadata.manager;

  if (!manager || typeof manager !== "object") {
    return {};
  }

  const managerRecord = manager as Record<string, unknown>;

  return {
    managerEmail: readStringValue(managerRecord, ["email", "mail", "userPrincipalName"]),
    managerName: readStringValue(managerRecord, ["name", "displayName", "fullName"]),
    managerTitle: readStringValue(managerRecord, ["title", "jobTitle", "positionTitle"])
  };
}

function mapMetadataDirectory(metadata?: Record<string, unknown> | null): DirectoryProfile {
  if (!metadata) {
    return {};
  }

  const nestedManager = readNestedManager(metadata);

  return {
    companyName: readStringValue(metadata, ["companyName", "company", "organization", "businessUnit"]),
    department: readStringValue(metadata, ["department", "departmentName", "orgUnit", "organizationUnit"]),
    jobTitle: readStringValue(metadata, ["jobTitle", "title", "positionTitle"]),
    employeeId: readStringValue(metadata, ["employeeId", "employeeNumber"]),
    employeeType: readStringValue(metadata, ["employeeType"]),
    employeeHireDate: readStringValue(metadata, ["employeeHireDate", "hireDate"]),
    officeLocation: readStringValue(metadata, ["officeLocation", "location", "workLocation", "site"]),
    managerEmail:
      readStringValue(metadata, ["managerEmail", "supervisorEmail", "leadEmail", "reportsToEmail"]) ??
      nestedManager.managerEmail,
    managerName:
      readStringValue(metadata, ["managerName", "manager", "supervisorName", "leadName", "reportsToName"]) ??
      nestedManager.managerName,
    managerTitle:
      readStringValue(metadata, ["managerTitle", "supervisorTitle", "leadTitle"]) ??
      nestedManager.managerTitle,
    sponsors: readStringList(metadata, ["sponsors", "sponsorNames"])
  };
}

async function fetchGraphJson<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchDirectoryFromGraph(accessToken: string): Promise<DirectoryProfile> {
  const [profile, manager, sponsors] = await Promise.all([
    fetchGraphJson<GraphProfile>(
      "https://graph.microsoft.com/v1.0/me?$select=companyName,department,jobTitle,employeeId,employeeType,officeLocation",
      accessToken
    ),
    fetchGraphJson<GraphManager>(
      "https://graph.microsoft.com/v1.0/me/manager?$select=displayName,mail,userPrincipalName,jobTitle",
      accessToken
    ),
    fetchGraphJson<{ value?: GraphSponsorItem[] }>(
      "https://graph.microsoft.com/v1.0/me/sponsors?$select=displayName",
      accessToken
    )
  ]);

  return {
    companyName: profile?.companyName,
    department: profile?.department,
    jobTitle: profile?.jobTitle,
    employeeId: profile?.employeeId,
    employeeType: profile?.employeeType,
    employeeHireDate: profile?.employeeHireDate,
    officeLocation: profile?.officeLocation,
    managerEmail: manager?.mail ?? manager?.userPrincipalName ?? undefined,
    managerName: manager?.displayName ?? undefined,
    managerTitle: manager?.jobTitle ?? undefined,
    sponsors: (sponsors?.value ?? [])
      .map((item) => item.displayName?.trim())
      .filter((name): name is string => Boolean(name))
  };
}

function mergeDirectoryProfiles(base: DirectoryProfile, incoming: DirectoryProfile): DirectoryProfile {
  return {
    companyName: incoming.companyName ?? base.companyName,
    department: incoming.department ?? base.department,
    jobTitle: incoming.jobTitle ?? base.jobTitle,
    employeeId: incoming.employeeId ?? base.employeeId,
    employeeType: incoming.employeeType ?? base.employeeType,
    employeeHireDate: incoming.employeeHireDate ?? base.employeeHireDate,
    officeLocation: incoming.officeLocation ?? base.officeLocation,
    managerEmail: incoming.managerEmail ?? base.managerEmail,
    managerName: incoming.managerName ?? base.managerName,
    managerTitle: incoming.managerTitle ?? base.managerTitle,
    sponsors: incoming.sponsors && incoming.sponsors.length > 0 ? incoming.sponsors : base.sponsors
  };
}

function mapAuthUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}, directory: DirectoryProfile): SessionUser | null {
  if (!user.email) {
    return null;
  }

  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name = typeof metadataName === "string" && metadataName.trim() ? metadataName : user.email;

  return {
    id: user.id,
    name,
    email: user.email.toLowerCase(),
    companyName: directory.companyName,
    department: directory.department,
    jobTitle: directory.jobTitle,
    employeeId: directory.employeeId,
    employeeType: directory.employeeType,
    employeeHireDate: directory.employeeHireDate,
    officeLocation: directory.officeLocation,
    managerEmail: normalizeEmail(directory.managerEmail),
    managerName: directory.managerName,
    managerTitle: directory.managerTitle,
    sponsors: directory.sponsors
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!hasSupabaseEnv) {
      setUser(null);
      setIsAdmin(false);
      setAuthError(supabaseEnvError ?? "Configuracion de Supabase incompleta.");
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    async function resolveUserFromSession(nextSession: Session): Promise<SessionUser | null> {
      const metadataDirectory = mapMetadataDirectory(nextSession.user.user_metadata);
      const providerToken =
        typeof nextSession.provider_token === "string" ? nextSession.provider_token : undefined;

      const graphDirectory =
        providerToken && (!metadataDirectory.managerEmail || !metadataDirectory.department || !metadataDirectory.jobTitle)
          ? await fetchDirectoryFromGraph(providerToken)
          : {};

      const mergedDirectory = mergeDirectoryProfiles(metadataDirectory, graphDirectory);
      const mappedUser = mapAuthUser(nextSession.user, mergedDirectory);

      if (!mappedUser) {
        return null;
      }

      const normalizedManagerEmail = normalizeEmail(mappedUser.managerEmail);
      const normalizedUserEmail = normalizeEmail(mappedUser.email);

      if (!normalizedManagerEmail || normalizedManagerEmail === normalizedUserEmail) {
        if (active) {
          setAuthError(
            "Tu cuenta no tiene jefatura inmediata valida en Microsoft Entra. Contacta a TI para actualizar tu manager e intenta nuevamente."
          );
        }
        await supabase.auth.signOut();
        return null;
      }

      if (active) {
        setAuthError(null);
      }

      return {
        ...mappedUser,
        managerEmail: normalizedManagerEmail
      };
    }

    async function syncSession(nextSession: Session | null) {
      if (!active) {
        return;
      }

      if (!nextSession) {
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const resolvedUser = await resolveUserFromSession(nextSession);

      if (!active) {
        return;
      }

      if (!resolvedUser) {
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      let nextIsAdmin = false;

      try {
        const adminCheck = await checkAdmin(resolvedUser.email);
        nextIsAdmin = Boolean(adminCheck.isAdmin);
      } catch {
        nextIsAdmin = false;
      }

      if (!active) {
        return;
      }

      setUser(resolvedUser);
      setIsAdmin(nextIsAdmin);
      setIsLoading(false);
    }

    supabase.auth
      .getSession()
      .then(({ data }) => syncSession(data.session))
      .catch(() => {
        if (!active) {
          return;
        }
        setUser(null);
        setIsAdmin(false);
        setAuthError("No se pudo validar la sesion. Intenta iniciar sesion nuevamente.");
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading,
      isAdmin,
      user,
      authError,
      async signInWithMicrosoft() {
        if (!hasSupabaseEnv) {
          throw new Error(supabaseEnvError ?? "Configuracion de Supabase incompleta.");
        }

        setAuthError(null);

        const redirectTo =
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "azure",
          options: {
            redirectTo,
            scopes: "openid profile email offline_access User.Read User.Read.All",
            queryParams: {
              prompt: "consent"
            }
          }
        });

        if (error) {
          throw error;
        }
      },
      async signOut() {
        if (!hasSupabaseEnv) {
          return;
        }

        setAuthError(null);
        await supabase.auth.signOut();
      }
    }),
    [authError, isAdmin, isLoading, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession debe usarse dentro de SessionProvider");
  }

  return context;
}
