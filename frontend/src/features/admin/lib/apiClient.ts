"use client";

function buildAdminApiCandidates() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const protocol = typeof window !== "undefined" ? window.location.protocol.toLowerCase() : "http:";
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const values: string[] = [];

  if (!isLocalHost) {
    values.push("/api");
  }

  const configuredIsHttpOnHttpsPage =
    Boolean(configured) && protocol === "https:" && configured?.toLowerCase().startsWith("http://");

  if (configured && !configuredIsHttpOnHttpsPage) {
    values.push(configured);
  }

  if (isLocalHost) {
    values.push("/api");

    if (!configured) {
      values.push("http://localhost:4000/api");
    }
  }

  if (!isLocalHost && protocol === "http:") {
    values.push(`http://${host}:4000/api`);
  }

  return Array.from(new Set(values.filter(Boolean)));
}

export async function adminFetch(path: string, init: RequestInit) {
  const candidates = buildAdminApiCandidates();
  let last404Response: Response | null = null;
  let lastError: unknown = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, init);

      if (response.status === 404) {
        last404Response = response;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (last404Response) {
    return last404Response;
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo contactar el API de SSD");
}

export async function readAdminPayload<T>(response: Response): Promise<T & { message?: string }> {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as T & { message?: string };
  } catch {
    const candidates = buildAdminApiCandidates();
    return {
      message: `Respuesta invalida del servidor (${response.status}). Verifica API/proxy. Rutas probadas: ${candidates.join(", ")}`
    } as T & { message?: string };
  }
}

