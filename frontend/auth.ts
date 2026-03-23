import { cache } from "react";
import { createClient as createSupabaseServerClient, hasSupabaseConfig } from "@/src/shared/lib/supabase/server";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

function getDisplayName(user: Record<string, unknown>, email: string) {
  return (
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name ??
    (user.user_metadata as Record<string, unknown> | undefined)?.name ??
    email
  );
}

export const auth = cache(async (): Promise<AppSession | null> => {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: String(getDisplayName(user as unknown as Record<string, unknown>, user.email))
    }
  };
});
