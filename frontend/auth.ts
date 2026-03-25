import { cache } from "react";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
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

const nextAuthInstance = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: microsoftAuthEnabled
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer
        })
      ]
    : [],
  session: {
    strategy: "jwt"
  }
});

export const { handlers, signIn, signOut, auth: getNextAuthSession } = nextAuthInstance;

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
  return null;
});
