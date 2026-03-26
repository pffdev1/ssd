"use client";

import { useMemo, useState } from "react";
import { runWithToast } from "@/src/shared/lib/toast";
import { AppUser, CatalogItem, RequestType } from "@/src/shared/lib/types";

const catalogViews = [
  {
    key: "REQUEST_TYPES",
    mode: "request-types",
    label: "Solicitudes",
    description: "Tipos de solicitud disponibles en SSD."
  },
  {
    key: "DEPARTMENT",
    mode: "catalog",
    label: "Departamentos",
    description: "Catalogo maestro de departamentos para ruteo de solicitudes."
  },
  {
    key: "BUSINESS_UNIT",
    mode: "catalog",
    label: "Unidades de negocio",
    description: "Base para futuras unidades, divisiones o marcas de SSD."
  },
  {
    key: "MOBILE_PLAN",
    mode: "catalog",
    label: "Planes celulares",
    description: "Catalogo visible para solicitudes de linea nueva."
  },
  {
    key: "IT_ASSET_TYPE",
    mode: "catalog",
    label: "Tipos de activos TI",
    description: "Equipos y accesorios disponibles para TI."
  }
] as const;

type CatalogView = (typeof catalogViews)[number];
type CatalogViewKey = CatalogView["key"];

function RequestTypeCard({
  requestType,
  active,
  onClick
}: {
  requestType: RequestType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
        active ? "border-[#0b5ed7] bg-[#eef5ff]" : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: requestType.theme_color }} />
            <div className="truncate text-sm font-semibold text-[#001534]">{requestType.name}</div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#1f406b]">{requestType.code}</div>
          <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{requestType.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
            {requestType.category}
          </div>
          <div className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
            {requestType.workflow.steps.length} paso{requestType.workflow.steps.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </button>
  );
}

export function CatalogSection({
  currentUser,
  items,
  requestTypes,
  onItemsChange,
  onRequestTypesChange
}: {
  currentUser: AppUser;
  items: CatalogItem[];
  requestTypes: RequestType[];
  onItemsChange: (items: CatalogItem[]) => void;
  onRequestTypesChange: (requestTypes: RequestType[]) => void;
}) {
  const apiCandidates = useMemo(() => {
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
  }, []);

  async function fetchApi(path: string, init: RequestInit) {
    let last404Response: Response | null = null;
    let lastError: unknown = null;

    for (const base of apiCandidates) {
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

  async function readPayload<T>(response: Response): Promise<T & { message?: string }> {
    const raw = await response.text();

    try {
      return JSON.parse(raw) as T & { message?: string };
    } catch {
      const candidates = apiCandidates.length > 0 ? apiCandidates.join(", ") : "sin rutas candidatas";
      return {
        message: `Respuesta invalida del servidor (${response.status}). Verifica API/proxy. Rutas probadas: ${candidates}`
      } as T & { message?: string };
    }
  }

  const [activeCatalogKey, setActiveCatalogKey] = useState<CatalogViewKey>("REQUEST_TYPES");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemLabel, setItemLabel] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [sortOrder, setSortOrder] = useState("10");
  const [editingRequestTypeId, setEditingRequestTypeId] = useState<string | null>(null);
  const [requestTypeCode, setRequestTypeCode] = useState("");
  const [requestTypeName, setRequestTypeName] = useState("");
  const [requestTypeDescription, setRequestTypeDescription] = useState("");
  const [requestTypeCategory, setRequestTypeCategory] = useState("");
  const [requestTypeColor, setRequestTypeColor] = useState("#0b5ed7");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeView = catalogViews.find((view) => view.key === activeCatalogKey) ?? catalogViews[0];
  const isRequestTypeView = activeView.mode === "request-types";

  const visibleItems = useMemo(
    () => items.filter((item) => item.catalog_key === activeCatalogKey).sort((a, b) => a.sort_order - b.sort_order),
    [activeCatalogKey, items]
  );

  const visibleRequestTypes = useMemo(
    () => [...requestTypes].sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code)),
    [requestTypes]
  );

  function resetCatalogForm(nextItems = visibleItems) {
    setEditingItemId(null);
    setItemLabel("");
    setItemValue("");
    setSortOrder(String((nextItems.at(-1)?.sort_order ?? 0) + 10));
  }

  function resetRequestTypeForm() {
    setEditingRequestTypeId(null);
    setRequestTypeCode("");
    setRequestTypeName("");
    setRequestTypeDescription("");
    setRequestTypeCategory("");
    setRequestTypeColor("#0b5ed7");
  }

  async function handleCatalogSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const endpoint = editingItemId
            ? `/admin/catalog-items/${editingItemId}`
            : "/admin/catalog-items";
          const response = await fetchApi(endpoint, {
            method: editingItemId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              catalogKey: activeCatalogKey,
              itemLabel,
              itemValue,
              sortOrder: Number(sortOrder)
            })
          });

          const payload = await readPayload<{ items?: CatalogItem[] }>(response);

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo actualizar el catalogo");
          }

          return payload;
        })(),
        {
          loading: { title: editingItemId ? "Actualizando registro..." : "Guardando catalogo..." },
          success: { title: editingItemId ? "Registro actualizado" : "Catalogo actualizado" },
          error: { title: "No se pudo guardar el catalogo" }
        }
      );

      const nextItems = data.items ?? items;
      onItemsChange(nextItems);
      setMessage(editingItemId ? "Registro actualizado correctamente." : "Registro agregado correctamente.");
      resetCatalogForm(nextItems.filter((item) => item.catalog_key === activeCatalogKey).sort((a, b) => a.sort_order - b.sort_order));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestTypeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const endpoint = editingRequestTypeId
            ? `/admin/request-types/${editingRequestTypeId}`
            : "/admin/request-types";
          const response = await fetchApi(endpoint, {
            method: editingRequestTypeId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              actorEmail: currentUser.email,
              code: requestTypeCode,
              name: requestTypeName,
              description: requestTypeDescription,
              category: requestTypeCategory,
              themeColor: requestTypeColor
            })
          });

          const payload = await readPayload<{ requestTypes?: RequestType[] }>(response);

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo guardar el tipo de solicitud");
          }

          return payload;
        })(),
        {
          loading: { title: editingRequestTypeId ? "Actualizando solicitud..." : "Creando solicitud..." },
          success: { title: editingRequestTypeId ? "Solicitud actualizada" : "Solicitud creada" },
          error: { title: "No se pudo guardar la solicitud" }
        }
      );

      onRequestTypesChange(data.requestTypes ?? requestTypes);
      setMessage(editingRequestTypeId ? "Tipo de solicitud actualizado correctamente." : "Tipo de solicitud creado correctamente.");
      resetRequestTypeForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRequestType() {
    if (!editingRequestTypeId) {
      return;
    }

    const confirmed = window.confirm("Se eliminara este tipo de solicitud. Solo podras hacerlo si no tiene solicitudes registradas.");

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const data = await runWithToast(
        (async () => {
          const response = await fetchApi(
            `/admin/request-types/${editingRequestTypeId}?actorEmail=${encodeURIComponent(currentUser.email)}`,
            {
              method: "DELETE"
            }
          );

          const payload = await readPayload<{ requestTypes?: RequestType[] }>(response);

          if (!response.ok) {
            throw new Error(payload.message ?? "No se pudo eliminar el tipo de solicitud");
          }

          return payload;
        })(),
        {
          loading: { title: "Eliminando solicitud..." },
          success: { title: "Solicitud eliminada" },
          error: { title: "No se pudo eliminar la solicitud" }
        }
      );

      onRequestTypesChange(data.requestTypes ?? requestTypes);
      resetRequestTypeForm();
      setMessage("Tipo de solicitud eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#1f406b]">Catalogos del sistema</div>
        <h3 className="mt-3 text-2xl font-semibold text-[#001534]">Parametros editables</h3>
        <p className="mt-3 text-sm leading-7 text-[#1e3a5f]">Administra catalogos operativos y publica nuevos tipos de solicitud desde un solo punto.</p>

        <div className="mt-6 space-y-3">
          {catalogViews.map((view) => {
            const active = view.key === activeCatalogKey;

            return (
              <button
                key={view.key}
                type="button"
                onClick={() => {
                  setActiveCatalogKey(view.key);
                  setMessage(null);

                  if (view.mode === "request-types") {
                    resetRequestTypeForm();
                    return;
                  }

                  resetCatalogForm(items.filter((item) => item.catalog_key === view.key).sort((a, b) => a.sort_order - b.sort_order));
                }}
                className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                  active
                    ? "border-[#8ebdff] bg-[#eef5ff] shadow-[0_12px_30px_rgba(11,94,215,0.08)]"
                    : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
                }`}
              >
                <div className="text-sm font-semibold text-[#001534]">{view.label}</div>
                <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">{view.description}</p>
              </button>
            );
          })}
        </div>
      </article>

      <article className="rounded-[1.8rem] border border-[#d7e4f2] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#1f406b]">{activeView.label}</div>
            <h3 className="mt-2 text-xl font-semibold text-[#001534]">
              {isRequestTypeView ? "Gestion de solicitudes" : "Gestion del catalogo"}
            </h3>
          </div>
          <div className="rounded-full border border-[#d7e4f2] bg-[#f5faff] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#1e3a5f]">
            {isRequestTypeView
              ? `${visibleRequestTypes.length} solicitud${visibleRequestTypes.length === 1 ? "" : "es"}`
              : `${visibleItems.length} elemento${visibleItems.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {isRequestTypeView ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-3">
              {visibleRequestTypes.map((requestType) => (
                <RequestTypeCard
                  key={requestType.id}
                  requestType={requestType}
                  active={editingRequestTypeId === requestType.id}
                  onClick={() => {
                    setEditingRequestTypeId(requestType.id);
                    setRequestTypeCode(requestType.code);
                    setRequestTypeName(requestType.name);
                    setRequestTypeDescription(requestType.description);
                    setRequestTypeCategory(requestType.category);
                    setRequestTypeColor(requestType.theme_color);
                    setMessage(`Editando: ${requestType.name}`);
                  }}
                />
              ))}

              {visibleRequestTypes.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#bfd2e7] bg-[#f9fbff] p-5 text-sm text-[#1e3a5f]">
                  Aun no hay tipos de solicitud configurados.
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
              <div className="text-sm font-semibold text-[#001534]">{editingRequestTypeId ? "Editar solicitud" : "Nueva solicitud"}</div>
              <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">
                Define la ficha base del tipo de solicitud. Luego podras ajustar su workflow en la seccion correspondiente.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleRequestTypeSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-[#1e3a5f]">Codigo tecnico</label>
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm uppercase text-[#001534] outline-none transition focus:border-[#0b5ed7] read-only:bg-slate-100"
                    value={requestTypeCode}
                    onChange={(event) => setRequestTypeCode(event.target.value)}
                    placeholder="Ej: TRAVEL_REQUEST"
                    required
                    readOnly={Boolean(editingRequestTypeId)}
                  />
                </div>

                <input
                  className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={requestTypeName}
                  onChange={(event) => setRequestTypeName(event.target.value)}
                  placeholder="Nombre visible"
                  required
                />

                <input
                  className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={requestTypeCategory}
                  onChange={(event) => setRequestTypeCategory(event.target.value)}
                  placeholder="Categoria"
                  required
                />

                <textarea
                  className="min-h-28 w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={requestTypeDescription}
                  onChange={(event) => setRequestTypeDescription(event.target.value)}
                  placeholder="Descripcion visible para el usuario"
                  required
                />

                <div className="grid gap-4 md:grid-cols-[0.24fr_0.76fr]">
                  <input
                    className="h-12 w-full cursor-pointer rounded-2xl border border-[#bfd2e7] bg-white p-2"
                    type="color"
                    value={requestTypeColor}
                    onChange={(event) => setRequestTypeColor(event.target.value)}
                    aria-label="Color de la solicitud"
                  />
                  <input
                    className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                    value={requestTypeColor}
                    onChange={(event) => setRequestTypeColor(event.target.value)}
                    placeholder="#0b5ed7"
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
                  >
                    {busy ? "Guardando..." : editingRequestTypeId ? "Actualizar" : "Crear"}
                  </button>
                  {editingRequestTypeId ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          resetRequestTypeForm();
                        }}
                        className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={deleteRequestType}
                        disabled={busy}
                        className="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </>
                  ) : null}
                </div>
              </form>

              {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-3">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEditingItemId(item.id);
                    setItemLabel(item.item_label);
                    setItemValue(item.item_value);
                    setSortOrder(String(item.sort_order));
                    setMessage(`Editando: ${item.item_label}`);
                  }}
                  className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                    editingItemId === item.id
                      ? "border-[#0b5ed7] bg-[#eef5ff]"
                      : "border-[#d7e4f2] bg-[#f9fbff] hover:bg-[#f2f7ff]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#001534]">{item.item_label}</div>
                      <div className="mt-1 text-sm text-[#1e3a5f]">{item.item_value}</div>
                    </div>
                    <div className="rounded-full border border-[#d7e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a5f]">
                      Orden {item.sort_order}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-[1.4rem] border border-[#d7e4f2] bg-[#f9fbff] p-5">
              <div className="text-sm font-semibold text-[#001534]">{editingItemId ? "Editar registro" : "Agregar registro"}</div>
              <p className="mt-2 text-sm leading-6 text-[#1e3a5f]">Haz clic en un elemento de la izquierda para editarlo o agrega uno nuevo.</p>

              <form className="mt-5 space-y-4" onSubmit={handleCatalogSubmit}>
                <input
                  className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={itemLabel}
                  onChange={(event) => setItemLabel(event.target.value)}
                  placeholder="Etiqueta visible"
                  required
                />
                <input
                  className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={itemValue}
                  onChange={(event) => setItemValue(event.target.value)}
                  placeholder="Valor interno"
                  required
                />
                <input
                  className="w-full rounded-2xl border border-[#bfd2e7] bg-white px-4 py-3 text-sm text-[#001534] outline-none transition focus:border-[#0b5ed7]"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  type="number"
                  placeholder="Orden"
                  required
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[#0b5ed7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0847a8] disabled:opacity-60"
                  >
                    {busy ? "Guardando..." : editingItemId ? "Actualizar" : "Agregar"}
                  </button>
                  {editingItemId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(null);
                        resetCatalogForm();
                      }}
                      className="rounded-full border border-[#bfd2e7] bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] transition hover:bg-[#eef5ff]"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>

              {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
