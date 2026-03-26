import { cache } from "react";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
    companyName?: string;
    department?: string;
    jobTitle?: string;
    employeeId?: string;
    employeeType?: string;
    employeeHireDate?: string;
    officeLocation?: string;
    entraRoles?: string[];
    managerEmail?: string;
    managerName?: string;
    managerTitle?: string;
    sponsors?: string[];
  };
};

const microsoftAuthEnabled = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
);

const rawIssuer =
  process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ??
  (process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
    ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
    : undefined);

const issuer = rawIssuer ? rawIssuer.replace(/\/+$/, "") : undefined;

const baseMicrosoftScope =
  process.env.AUTH_MICROSOFT_GRAPH_SCOPE ??
  "openid profile email offline_access User.Read User.Read.All";

const teamOrgChartScope = process.env.AUTH_TEAM_ORGCHART_SCOPE?.trim();
const teamOrgChartApiUrl = process.env.TEAM_ORGCHART_API_URL?.trim();

const microsoftScope = [baseMicrosoftScope, teamOrgChartScope]
  .filter((value): value is string => Boolean(value))
  .join(" ");

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

type TeamOrgChartProfile = {
  managerEmail?: string;
  managerName?: string;
  managerTitle?: string;
  department?: string;
  jobTitle?: string;
  officeLocation?: string;
  companyName?: string;
};

async function fetchGraphProfile(accessToken: string): Promise<GraphProfile | null> {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=companyName,department,jobTitle,employeeId,employeeType,officeLocation",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GraphProfile;
    return payload;
  } catch {
    return null;
  }
}

async function fetchGraphManager(accessToken: string): Promise<GraphManager | null> {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/manager?$select=displayName,mail,userPrincipalName,jobTitle",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      console.warn("[auth][graph] manager lookup failed", {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const payload = (await response.json()) as GraphManager;
    return payload;
  } catch {
    console.warn("[auth][graph] manager lookup failed: network/runtime error");
    return null;
  }
}

async function fetchGraphSponsors(accessToken: string): Promise<string[]> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/sponsors?$select=displayName", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { value?: GraphSponsorItem[] };
    return (payload.value ?? [])
      .map((item) => item.displayName?.trim())
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
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

function readNestedString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const nested = payload[key];

    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const value =
        readStringValue(nestedRecord, ["email", "mail", "userPrincipalName", "upn"]) ??
        readStringValue(nestedRecord, ["name", "displayName", "fullName", "title"]);

      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function mapTeamOrgChartProfile(payload: Record<string, unknown>): TeamOrgChartProfile {
  const managerName =
    readStringValue(payload, ["managerName", "manager", "supervisorName", "leadName", "reportsToName"]) ??
    readNestedString(payload, ["manager", "supervisor", "lead", "reportsTo"]);

  const managerEmail =
    readStringValue(payload, ["managerEmail", "supervisorEmail", "leadEmail", "reportsToEmail"]) ??
    (payload.manager && typeof payload.manager === "object"
      ? readStringValue(payload.manager as Record<string, unknown>, ["email", "mail", "userPrincipalName"])
      : undefined);

  return {
    managerName,
    managerEmail,
    managerTitle: readStringValue(payload, ["managerTitle", "supervisorTitle", "leadTitle"]),
    department: readStringValue(payload, ["department", "departmentName", "orgUnit", "organizationUnit"]),
    jobTitle: readStringValue(payload, ["jobTitle", "title", "positionTitle"]),
    officeLocation: readStringValue(payload, ["officeLocation", "location", "workLocation", "site"]),
    companyName: readStringValue(payload, ["companyName", "businessUnit", "company", "organization"])
  };
}

async function exchangeRefreshTokenForScope(input: {
  refreshToken: string;
  scope: string;
}) {
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      scope: input.scope
    }).toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    console.warn("[auth][teamorgchart] token exchange failed", {
      status: response.status,
      statusText: response.statusText
    });
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token
  };
}

async function fetchTeamOrgChartProfile(accessToken: string): Promise<TeamOrgChartProfile | null> {
  if (!teamOrgChartApiUrl) {
    return null;
  }

  try {
    const response = await fetch(teamOrgChartApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("[auth][teamorgchart] profile lookup failed", {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return mapTeamOrgChartProfile(payload);
  } catch {
    console.warn("[auth][teamorgchart] profile lookup failed: network/runtime error");
    return null;
  }
}

const nextAuthInstance = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: microsoftAuthEnabled
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer,
          authorization: {
            params: {
              scope: microsoftScope
            }
          }
        })
      ]
    : [],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      const tokenState = token as typeof token & {
        microsoftRefreshToken?: string;
        teamOrgChartSyncedAt?: number;
      };

      if (account?.provider === "microsoft-entra-id" && account.access_token) {
        token.accessToken = account.access_token;

        if (account.refresh_token) {
          tokenState.microsoftRefreshToken = account.refresh_token;
        }

        const graphProfile = await fetchGraphProfile(account.access_token);

        if (graphProfile) {
          token.companyName = graphProfile.companyName;
          token.department = graphProfile.department;
          token.jobTitle = graphProfile.jobTitle;
          token.employeeId = graphProfile.employeeId;
          token.employeeType = graphProfile.employeeType;
          token.employeeHireDate = graphProfile.employeeHireDate;
          token.officeLocation = graphProfile.officeLocation;
        }

        const graphManager = await fetchGraphManager(account.access_token);

        if (graphManager) {
          token.managerEmail = (graphManager.mail ?? graphManager.userPrincipalName ?? undefined) || undefined;
          token.managerName = graphManager.displayName ?? undefined;
          token.managerTitle = graphManager.jobTitle ?? undefined;
        }

        const sponsors = await fetchGraphSponsors(account.access_token);
        token.sponsors = sponsors;
      }

      if (teamOrgChartScope && teamOrgChartApiUrl && tokenState.microsoftRefreshToken) {
        const now = Date.now();
        const shouldRefreshTeamOrgChart =
          !tokenState.teamOrgChartSyncedAt || now - tokenState.teamOrgChartSyncedAt > 15 * 60 * 1000;

        if (shouldRefreshTeamOrgChart) {
          const exchanged = await exchangeRefreshTokenForScope({
            refreshToken: tokenState.microsoftRefreshToken,
            scope: `${teamOrgChartScope} offline_access`
          });

          if (exchanged?.accessToken) {
            if (exchanged.refreshToken) {
              tokenState.microsoftRefreshToken = exchanged.refreshToken;
            }

            const teamProfile = await fetchTeamOrgChartProfile(exchanged.accessToken);

            if (teamProfile) {
              token.managerEmail = teamProfile.managerEmail ?? token.managerEmail;
              token.managerName = teamProfile.managerName ?? token.managerName;
              token.managerTitle = teamProfile.managerTitle ?? token.managerTitle;
              token.department = teamProfile.department ?? token.department;
              token.jobTitle = teamProfile.jobTitle ?? token.jobTitle;
              token.officeLocation = teamProfile.officeLocation ?? token.officeLocation;
              token.companyName = teamProfile.companyName ?? token.companyName;
            }
          }

          tokenState.teamOrgChartSyncedAt = now;
        }
      }

      if (profile && typeof profile === "object" && "roles" in profile && Array.isArray(profile.roles)) {
        token.entraRoles = profile.roles.filter((role): role is string => typeof role === "string");
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          companyName?: string;
          department?: string;
          jobTitle?: string;
          employeeId?: string;
          employeeType?: string;
          employeeHireDate?: string;
          officeLocation?: string;
          entraRoles?: string[];
          managerEmail?: string;
          managerName?: string;
          managerTitle?: string;
          sponsors?: string[];
        };

        sessionUser.companyName = typeof token.companyName === "string" ? token.companyName : undefined;
        sessionUser.department = typeof token.department === "string" ? token.department : undefined;
        sessionUser.jobTitle = typeof token.jobTitle === "string" ? token.jobTitle : undefined;
        sessionUser.employeeId = typeof token.employeeId === "string" ? token.employeeId : undefined;
        sessionUser.employeeType = typeof token.employeeType === "string" ? token.employeeType : undefined;
        sessionUser.employeeHireDate = typeof token.employeeHireDate === "string" ? token.employeeHireDate : undefined;
        sessionUser.officeLocation = typeof token.officeLocation === "string" ? token.officeLocation : undefined;
        sessionUser.entraRoles = Array.isArray(token.entraRoles)
          ? token.entraRoles.filter((role): role is string => typeof role === "string")
          : undefined;
        sessionUser.managerEmail = typeof token.managerEmail === "string" ? token.managerEmail : undefined;
        sessionUser.managerName = typeof token.managerName === "string" ? token.managerName : undefined;
        sessionUser.managerTitle = typeof token.managerTitle === "string" ? token.managerTitle : undefined;
        sessionUser.sponsors = Array.isArray(token.sponsors)
          ? token.sponsors.filter((item): item is string => typeof item === "string")
          : undefined;
      }

      return session;
    }
  }
});

export const { handlers, signIn, signOut, auth: getNextAuthSession } = nextAuthInstance;

export const auth = cache(async (): Promise<AppSession | null> => {
  const nextAuthSession = await getNextAuthSession();

  if (nextAuthSession?.user?.email) {
    const userWithDirectory = nextAuthSession.user as typeof nextAuthSession.user & {
      companyName?: string;
      department?: string;
      jobTitle?: string;
      employeeId?: string;
      employeeType?: string;
      employeeHireDate?: string;
      officeLocation?: string;
      entraRoles?: string[];
      managerEmail?: string;
      managerName?: string;
      managerTitle?: string;
      sponsors?: string[];
    };

    return {
      user: {
        id: nextAuthSession.user.email.toLowerCase(),
        email: nextAuthSession.user.email.toLowerCase(),
        name: nextAuthSession.user.name ?? nextAuthSession.user.email,
        companyName: userWithDirectory.companyName,
        department: userWithDirectory.department,
        jobTitle: userWithDirectory.jobTitle,
        employeeId: userWithDirectory.employeeId,
        employeeType: userWithDirectory.employeeType,
        employeeHireDate: userWithDirectory.employeeHireDate,
        officeLocation: userWithDirectory.officeLocation,
        entraRoles: userWithDirectory.entraRoles,
        managerEmail: userWithDirectory.managerEmail,
        managerName: userWithDirectory.managerName,
        managerTitle: userWithDirectory.managerTitle,
        sponsors: userWithDirectory.sponsors
      }
    };
  }
  return null;
});
