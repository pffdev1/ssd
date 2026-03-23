import { parseBeneficiaries } from "@/src/shared/lib/beneficiaries";

export function BeneficiaryList({
  payload,
  fallback = "N/A",
  compact = false
}: {
  payload: Record<string, unknown>;
  fallback?: string;
  compact?: boolean;
}) {
  const beneficiaries = parseBeneficiaries(payload);

  if (beneficiaries.length === 0) {
    return <span className="text-sm text-[#1e3a5f]">{fallback}</span>;
  }

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {beneficiaries.map((beneficiary, index) => (
          <span
            key={`${beneficiary}-${index}`}
            className="rounded-full border border-[#c9daf4] bg-[#f3f8ff] px-3 py-1.5 text-xs font-medium text-[#164b97]"
          >
            {beneficiary}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {beneficiaries.map((beneficiary, index) => (
        <div
          key={`${beneficiary}-${index}`}
          className="rounded-2xl border border-[#d7e4f2] bg-[#f8fbff] px-4 py-3 text-sm font-medium text-[#001534]"
        >
          {beneficiary}
        </div>
      ))}
    </div>
  );
}
