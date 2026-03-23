import Image from "next/image";
import Link from "next/link";

export function BrandMark({ compact = false, contrast = "light" }: { compact?: boolean; contrast?: "light" | "dark" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e4f2] bg-white shadow-[0_14px_30px_rgba(0,21,52,0.1)]">
        <Image src="/brand/pedersen-connect-logo.png" alt="Pedersen Connect" width={48} height={48} className="h-full w-full object-cover" />
      </div>
      <div className={compact ? "hidden sm:block" : "block"}>
        <div className={`text-[11px] uppercase tracking-[0.34em] ${contrast === "dark" ? "text-[#1f406b]" : "text-[#d8e9ff]"}`}>
          Pedersen Connect
        </div>
        <div className={`mt-1 text-base font-semibold ${contrast === "dark" ? "text-[#001534]" : "text-white"}`}>
          Sistema de Solicitudes Digital
        </div>
      </div>
    </Link>
  );
}
