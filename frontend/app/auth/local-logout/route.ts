import { NextResponse } from "next/server";

const LOCAL_SESSION_COOKIE = "ssd_local_session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
