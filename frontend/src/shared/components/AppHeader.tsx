"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut as microsoftSignOut } from "next-auth/react";
import { infoToast } from "@/src/shared/lib/toast";
import { AppUser, RequestType } from "@/src/shared/lib/types";
import { BrandMark } from "./BrandMark";

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center">{children}</span>;
}

function HomeIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
      </svg>
    </NavIcon>
  );
}

function CatalogIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M5 6.5h14" />
        <path d="M5 12h14" />
        <path d="M5 17.5h14" />
      </svg>
    </NavIcon>
  );
}

function TicketIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
        <path d="M9 9.5h6" />
        <path d="M9 14.5h4" />
      </svg>
    </NavIcon>
  );
}

function InboxIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M4 6h16v12H4z" />
        <path d="M4 13h4l2 3h4l2-3h4" />
      </svg>
    </NavIcon>
  );
}

function UserIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.8-3 4.2-4.5 7-4.5s5.2 1.5 7 4.5" />
      </svg>
    </NavIcon>
  );
}

function BellIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    </NavIcon>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function buildCatalogHref(typeCode: string) {
  return `/solicitudes/${encodeURIComponent(typeCode)}`;
}

type HeaderItem = "home" | "catalog" | "my-requests" | "inbox" | "profile" | "admin";

function getActiveItem(pathname: string, fallback?: HeaderItem) {
  if (fallback) {
    return fallback;
  }

  if (pathname === "/") {
    return "home";
  }

  if (pathname.startsWith("/catalogo") || pathname.startsWith("/solicitudes/")) {
    return "catalog";
  }

  if (pathname.startsWith("/mis-solicitudes")) {
    return "my-requests";
  }

  if (pathname.startsWith("/inbox")) {
    return "inbox";
  }

  if (pathname.startsWith("/perfil")) {
    return "profile";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  return undefined;
}

export function AppHeader({
  user,
  inboxCount,
  isAdmin,
  activeItem,
  title,
  subtitle,
  requestTypes = []
}: {
  user: AppUser;
  inboxCount: number;
  isAdmin?: boolean;
  activeItem?: HeaderItem;
  title: string;
  subtitle: string;
  requestTypes?: RequestType[];
}) {
  const pathname = usePathname();
  const resolvedActiveItem = getActiveItem(pathname, activeItem);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCatalogOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (catalogRef.current && !catalogRef.current.contains(target)) {
        setCatalogOpen(false);
      }

      if (userRef.current && !userRef.current.contains(target)) {
        setUserOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const navClass = (item: HeaderItem) =>
    resolvedActiveItem === item
      ? "inline-flex min-w-max shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#5d97ff] bg-[#dcecff] px-4 py-3 text-sm font-semibold text-[#0b5ed7] transition"
      : "inline-flex min-w-max shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#99bde6] bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-[#5d97ff] hover:bg-white/16";

  const userMenuActive = resolvedActiveItem === "profile" || resolvedActiveItem === "admin";

  const visibleRequestTypes = useMemo(() => requestTypes, [requestTypes]);
  const unreadLabel = inboxCount > 99 ? "99+" : String(inboxCount);

  function handleNotificationClick() {
    if (inboxCount > 0) {
      infoToast("Alertas pendientes en SSD", `Tienes ${unreadLabel} alerta${inboxCount === 1 ? "" : "s"} pendiente${inboxCount === 1 ? "" : "s"}. Revisa la opcion Bandeja del menu principal.`);
      return;
    }

    infoToast("Sin alertas pendientes", "No tienes aprobaciones ni alertas pendientes en este momento.");
  }

  async function handleSignOut() {
    try {
      await microsoftSignOut({ redirect: false });
    } catch {
      // If signout fails, fallback to login redirect.
    }

    window.location.assign("/login");
  }

  return (
    <header className="rounded-[2rem] border border-[#3c68a8] bg-[linear-gradient(135deg,#0c2958_0%,#11407a_42%,#0b5ed7_100%)] px-6 py-5 text-white shadow-[0_24px_70px_rgba(10,41,84,0.28)] lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <BrandMark contrast="light" />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleNotificationClick}
              className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
                resolvedActiveItem === "inbox"
                  ? "border-[#8bb8ff] bg-[#dcecff] text-[#0b5ed7]"
                  : "border-[#8caed8] bg-white/12 text-white hover:bg-white/18"
              }`}
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <span className={inboxCount > 0 ? "ssd-bell-ring" : ""}>
                <BellIcon />
              </span>
              {inboxCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 animate-pulse items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-[#0b5ed7] shadow-[0_8px_18px_rgba(15,23,42,0.22)]">
                  {unreadLabel}
                </span>
              ) : null}
            </button>

            <div ref={userRef} className="relative flex justify-end">
              <button
                type="button"
                onClick={() => setUserOpen((current) => !current)}
                className={`flex items-center gap-3 rounded-full border px-4 py-3 text-sm transition ${
                  userMenuActive || userOpen
                    ? "border-[#8bb8ff] bg-[#dcecff] text-[#0b5ed7]"
                    : "border-[#8caed8] bg-white/12 text-white hover:bg-white/18"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0b5ed7]">
                  <UserIcon />
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="font-semibold">{user.name}</span>
                  <span className={`text-xs ${userMenuActive || userOpen ? "text-[#52708f]" : "text-white/75"}`}>{user.email}</span>
                </span>
                <ChevronIcon open={userOpen} />
              </button>

              {userOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[18rem] rounded-[1.5rem] border border-[#bfd2e7] bg-white p-3 text-[#001534] shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
                  <div className="mb-2 px-3 pt-2 text-xs uppercase tracking-[0.24em] text-[#0b5ed7]">Tu cuenta</div>
                  <div className="space-y-1">
                    <Link
                      prefetch={false}
                      href="/perfil"
                      className={`block rounded-2xl px-3 py-3 text-sm transition ${
                        resolvedActiveItem === "profile" ? "bg-[#e9f2ff] font-semibold text-[#0b5ed7]" : "text-[#1e3a5f] hover:bg-[#eaf6ff]"
                      }`}
                    >
                      Perfil
                    </Link>
                    {isAdmin ? (
                      <Link
                        prefetch={false}
                        href="/admin"
                        className={`block rounded-2xl px-3 py-3 text-sm transition ${
                          resolvedActiveItem === "admin" ? "bg-[#e9f2ff] font-semibold text-[#0b5ed7]" : "text-[#1e3a5f] hover:bg-[#eaf6ff]"
                        }`}
                      >
                        Administracion
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[#1e3a5f] transition hover:bg-[#eaf6ff]"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 pt-5">
          <div>
            <h1 className="text-3xl font-semibold lg:text-4xl">{title}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[#dbe7f8]">{subtitle}</p>
          </div>
        </div>

        <div className="relative">
          <nav className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link prefetch={false} href="/" className={navClass("home")}>
              <HomeIcon />
              Home
            </Link>

            <div ref={catalogRef} className="relative shrink-0">
              <button type="button" onClick={() => setCatalogOpen((current) => !current)} className={navClass("catalog")}>
                <CatalogIcon />
                Catalogo de solicitudes
                <ChevronIcon open={catalogOpen} />
              </button>

              {catalogOpen ? (
                <div className="absolute left-0 top-[calc(100%+12px)] z-40 w-[24rem] rounded-[1.5rem] border border-[#bfd2e7] bg-white p-3 text-[#001534] shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
                  <div className="mb-2 px-3 pt-2 text-xs uppercase tracking-[0.24em] text-[#0b5ed7]">Solicitudes disponibles</div>
                  <div className="space-y-1">
                    {visibleRequestTypes.map((type) => (
                      <Link
                        prefetch={false}
                        key={type.code}
                        href={buildCatalogHref(type.code)}
                        className="block rounded-2xl px-3 py-3 text-sm text-[#1e3a5f] transition hover:bg-[#eaf6ff] hover:text-[#001534]"
                      >
                        {type.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Link prefetch={false} href="/mis-solicitudes" className={navClass("my-requests")}>
              <TicketIcon />
              Mis solicitudes
            </Link>

            <Link prefetch={false} href="/inbox" className={navClass("inbox")}>
              <InboxIcon />
              Bandeja {inboxCount > 0 ? `(${inboxCount})` : ""}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
