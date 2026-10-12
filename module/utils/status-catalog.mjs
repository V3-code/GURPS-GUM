const normalizeStatusSearchText = value => String(value ?? "")
  .trim()
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const localizeStatusLabel = (value, localize = globalThis.game?.i18n?.localize?.bind(globalThis.game.i18n)) => {
  const label = String(value ?? "").trim();
  if (!label || typeof localize !== "function") return label;
  return String(localize(label) ?? label).trim() || label;
};

export function buildStatusCatalog(statusEffects = [], { localize } = {}) {
  return Array.from(statusEffects ?? [], status => ({
    id: String(status?.id ?? "").trim(),
    label: localizeStatusLabel(status?.name ?? status?.label ?? status?.id, localize),
    img: String(status?.icon ?? status?.img ?? "").trim()
  }))
    .filter(status => status.id)
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));
}

export function resolveStatusCatalogEntry(value, statusEffects = []) {
  const wanted = normalizeStatusSearchText(value);
  if (!wanted) return null;
  const catalog = buildStatusCatalog(statusEffects);
  return catalog.find(status => normalizeStatusSearchText(status.id) === wanted)
    ?? catalog.find(status => normalizeStatusSearchText(status.label) === wanted)
    ?? null;
}

export function findConfiguredStatus(statusId, statusEffects = []) {
  const wanted = String(statusId ?? "").trim();
  return wanted ? buildStatusCatalog(statusEffects).find(status => status.id === wanted) ?? null : null;
}
