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

const microsoftGraphScope =
  process.env.AUTH_MICROSOFT_GRAPH_SCOPE ??
  "openid profile email offline_access User.Read User.Read.All";

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
              scope: microsoftGraphScope
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
      if (account?.provider === "microsoft-entra-id" && account.access_token) {
        token.accessToken = account.access_token;
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
