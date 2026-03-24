import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import { auth } from "@/auth";
import { MicrosoftEntraLoginButton } from "@/src/features/auth/components/MicrosoftEntraLoginButton";

const LOCAL_SESSION_COOKIE = "ssd_local_session";

export default async function LoginPage() {
  const session = await auth();
  const entraReady = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID &&
      process.env.AUTH_SECRET
  );

  if (session?.user?.email) {
    redirect("/");
  }

  async function loginLocal() {
    "use server";

    const name = process.env.LOCAL_AUTH_NAME ?? "Weelmer Moreno";
    const email = (process.env.LOCAL_AUTH_EMAIL ?? "weelmer.moreno@pffsa.com").toLowerCase();
    const payload = Buffer.from(JSON.stringify({ name, email }), "utf8").toString("base64url");

    const cookieStore = await cookies();
    cookieStore.set(LOCAL_SESSION_COOKIE, payload, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    redirect("/");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,64,107,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,21,52,0.16),transparent_30%)]" />
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2.6rem] border border-[#c7d8ea] bg-white shadow-[0_32px_90px_rgba(0,21,52,0.12)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden bg-[linear-gradient(145deg,#f8fbff_0%,#eef5fd_55%,#dde9f5_100%)] px-8 py-12 lg:px-12 lg:py-16">
            <div className="absolute right-[-80px] top-[-70px] h-56 w-56 rounded-full bg-[rgba(31,64,107,0.08)] blur-2xl" />
            <div className="absolute bottom-[-120px] left-[-20px] h-64 w-64 rounded-full bg-[rgba(0,21,52,0.08)] blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-4 rounded-[1.8rem] border border-[#d7e4f2] bg-white/90 px-4 py-4 shadow-[0_16px_35px_rgba(0,21,52,0.08)] backdrop-blur">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.3rem] border border-[#d7e4f2] bg-white">
                  <Image
                    src="/brand/pedersen-connect-logo.png"
                    alt="Pedersen Connect"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.34em] text-[#1f406b]">Pedersen Connect</div>
                  <div className="mt-1 text-xl font-semibold text-[#001534]">Sistema de Solicitudes Digital</div>
                  <div className="mt-1 text-sm font-medium text-[#1e3a5f]">SSD</div>
                </div>
              </div>

              <h1 className="mt-10 max-w-2xl text-4xl font-semibold leading-tight text-[#001534] sm:text-5xl">
                Solicitudes y aprobaciones corporativas en una sola experiencia.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#1e3a5f] sm:text-lg">
                Ingresa con tu cuenta empresarial para acceder a tus formularios, bandeja de aprobaciones y trazabilidad operativa.
              </p>
            </div>
          </section>

          <section className="flex items-center bg-[#f7fbff] px-6 py-10 sm:px-8 lg:px-10 lg:py-16">
            <div className="w-full rounded-[2rem] border border-[#7197bf] bg-white p-6 shadow-[0_18px_50px_rgba(0,21,52,0.08)] sm:p-8">
              <div className="text-xs uppercase tracking-[0.25em] text-[#1f406b]">Ingreso corporativo</div>
              <h2 className="mt-4 text-3xl font-semibold text-[#001534]">Entrar a SSD</h2>
              <p className="mt-4 text-sm leading-7 text-[#1e3a5f]">Usa tu cuenta corporativa de Pedersen para continuar.</p>
              <div className="mt-8 space-y-4">
                <MicrosoftEntraLoginButton disabled={!entraReady} />

                {!entraReady ? (
                  <p className="rounded-2xl border border-[#ffd4a8] bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-[#9a3412]">
                    Falta configurar `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` y `AUTH_SECRET`.
                  </p>
                ) : null}

                <form action={loginLocal}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-4 rounded-[1.5rem] border border-[#bfd2e7] bg-[#f7fbff] px-6 py-4 text-sm font-semibold text-[#1e3a5f] transition hover:border-[#9cb8d6] hover:bg-[#f5faff]"
                  >
                    Entrar en modo local (respaldo)
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
