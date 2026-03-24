import { cache } from "react";
import { cookies } from "next/headers";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

const LOCAL_SESSION_COOKIE = "ssd_local_session";

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
