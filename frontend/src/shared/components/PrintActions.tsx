"use client";

import { useRouter } from "next/navigation";

function sanitizeDocumentTitle(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function PrintActions({ documentTitle }: { documentTitle?: string }) {
  const router = useRouter();

  const handlePrint = () => {
    const previousTitle = document.title;

    if (!documentTitle) {
      window.print();
      return;
    }

    const nextTitle = sanitizeDocumentTitle(documentTitle);
    document.title = nextTitle;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.print();
    window.setTimeout(restoreTitle, 1000);
  };

  return (
    <div className="print:hidden flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handlePrint}
        className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8]"
      >
        Imprimir / Descargar PDF
      </button>
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#f5faff]"
      >
        Volver
      </button>
    </div>
  );
}
