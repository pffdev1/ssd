import { cache } from "react";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

const LOCAL_SESSION_COOKIE = "ssd_local_session";

const microsoftAuthEnabled = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
);

const nextAuthInstance = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: microsoftAuthEnabled
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        })
      ]
    : [],
  session: {
    strategy: "jwt"
  }
});

export const { handlers, signIn, signOut, auth: getNextAuthSession } = nextAuthInstance;

type LocalSessionPayload = {
  name: string;
  email: string;
};

function decodeLocalSession(raw: string): LocalSessionPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Partial<LocalSessionPayload>;

    if (!payload.email || !payload.name) {
      return null;
    }

    return {
      name: String(payload.name),
      email: String(payload.email).toLowerCase()
    };
  } catch {
    return null;
  }
}

export const auth = cache(async (): Promise<AppSession | null> => {
  const nextAuthSession = await getNextAuthSession();

  if (nextAuthSession?.user?.email) {
    return {
      user: {
        id: nextAuthSession.user.email.toLowerCase(),
        email: nextAuthSession.user.email.toLowerCase(),
        name: nextAuthSession.user.name ?? nextAuthSession.user.email
      }
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = decodeLocalSession(token);

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.email,
      email: session.email,
      name: session.name
    }
  };
});
