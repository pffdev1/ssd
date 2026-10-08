import { useMemo, useState } from 'react';

export type CatalogItem = {
  code: string;
  name: string;
  description: string;
};

export default function RequestTypeCatalog({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return items.filter((item) =>
      `${item.name} ${item.description} ${item.code}`.toLocaleLowerCase('es').includes(term),
    );
  }, [items, query]);

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">Base de solicitudes</p>
          <h2 id="catalog-title">Tipos disponibles</h2>
        </div>
        <span className="count">{items.length} configurados</span>
      </div>
      {items.length > 0 && (
        <label className="search-label">
          Buscar un tipo de solicitud
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o código"
          />
        </label>
      )}
      {items.length === 0 ? (
        <p className="empty">Aún no hay tipos de solicitud. Aplica la migración local y agrega datos de prueba.</p>
      ) : visible.length === 0 ? (
        <p className="empty">No hay resultados para esa búsqueda.</p>
      ) : (
        <ul className="catalog-grid">
          {visible.map((item) => (
            <li className="catalog-card" key={item.code}>
              <span className="code">{item.code}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
