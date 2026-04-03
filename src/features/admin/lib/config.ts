export type AdminSection = "overview" | "steps" | "workflows" | "catalogs" | "admins" | "mobile";

export type CatalogViewKey =
  | "REQUEST_TYPES"
  | "DEPARTMENT"
  | "BUSINESS_UNIT"
  | "MOBILE_PLAN"
  | "IT_ASSET_TYPE";

export type CatalogView = {
  key: CatalogViewKey;
  mode: "request-types" | "catalog";
  label: string;
  description: string;
};

export const catalogViews: CatalogView[] = [
  { key: "REQUEST_TYPES", mode: "request-types", label: "Solicitudes", description: "Tipos de solicitud en SSD." },
  { key: "DEPARTMENT", mode: "catalog", label: "Departamentos", description: "Catalogo para ruteo por area." },
  { key: "BUSINESS_UNIT", mode: "catalog", label: "Unidades de negocio", description: "Catalogo de divisiones." },
  { key: "MOBILE_PLAN", mode: "catalog", label: "Planes celulares", description: "Planes para lineas nuevas." },
  { key: "IT_ASSET_TYPE", mode: "catalog", label: "Tipos de activos TI", description: "Activos disponibles para TI." }
];
