"use client";

function MicrosoftMark() {
  return (
    <span className="grid grid-cols-2 gap-[3px] rounded-[0.35rem] bg-white p-[3px] shadow-sm">
      <span className="h-3 w-3 bg-[#f25022]" />
      <span className="h-3 w-3 bg-[#7fba00]" />
      <span className="h-3 w-3 bg-[#00a4ef]" />
      <span className="h-3 w-3 bg-[#ffb900]" />
    </span>
  );
}

export function MicrosoftEntraLoginButton({ disabled = false }: { disabled?: boolean }) {
  function handleLogin() {
    if (disabled) {
      return;
    }

    window.location.assign("/api/auth/signin/microsoft-entra-id?callbackUrl=/");
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-4 rounded-[1.5rem] border border-[#bfd2e7] bg-white px-6 py-4 text-sm font-semibold text-[#001534] transition hover:border-[#9cb8d6] hover:bg-[#f5faff] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <MicrosoftMark />
      <span>Entrar con cuenta corporativa</span>
    </button>
  );
}
