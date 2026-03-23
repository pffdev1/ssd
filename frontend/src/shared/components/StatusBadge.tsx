import { getStatusLabel } from "@/src/shared/lib/status";

const palette: Record<string, string> = {
  pending_area_approval: "bg-[#eaf6ff] text-[#1e3a5f] ring-1 ring-[#bfd2e7]",
  pending_general_management: "bg-[#dfeafb] text-[#1f406b] ring-1 ring-[#bfd2e7]",
  pending_hr: "bg-[#edf8f4] text-[#2f6f5c] ring-1 ring-[#b8dbcc]",
  pending_finance: "bg-[#eef2fb] text-[#304f87] ring-1 ring-[#c7d4ee]",
  pending_it: "bg-[#edf5fd] text-[#1f406b] ring-1 ring-[#bfd2e7]",
  in_fulfillment: "bg-[#edf5fd] text-[#001534] ring-1 ring-[#bfd2e7]",
  approved: "bg-[#edf8f4] text-[#2f6f5c] ring-1 ring-[#b8dbcc]",
  completed: "bg-[#e8f4f3] text-[#216c78] ring-1 ring-[#b9d8dd]",
  rejected: "bg-[#fff1f2] text-[#9d374d] ring-1 ring-[#f0c7cf]",
  pending_review: "bg-[#f2f5f8] text-[#46607d] ring-1 ring-[#d1dce7]",
  pending: "bg-[#fff5ea] text-[#a86a3b] ring-1 ring-[#ecd2b8]",
  queued: "bg-[#f2f5f8] text-[#46607d] ring-1 ring-[#d1dce7]"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
        palette[status] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
