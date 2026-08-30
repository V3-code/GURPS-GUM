const localize = (key, fallback) => globalThis.game?.i18n?.localize?.(key) ?? fallback;

export function formatTestRequestStatus(response) {
  if (!response) return localize("GUM.TestRequest.Status.Waiting", "Aguardando");
  const labels = {
    "critical-success": localize("GUM.TestRequest.Status.CriticalSuccess", "Sucesso Crítico"),
    "critical-failure": localize("GUM.TestRequest.Status.CriticalFailure", "Falha Crítica"),
    success: localize("GUM.TestRequest.Status.Success", "Sucesso"),
    failure: localize("GUM.TestRequest.Status.Failure", "Falha")
  };
  const label = labels[response.outcome] ?? response.resultLabel;
  if (response.outcome === "critical-success" || response.outcome === "critical-failure") return label;
  return `${label} (${Math.abs(Number(response.margin) || 0)})`;
}

export function prepareModifierBreakdown(response, fixedModifier = 0, fixedModifierLabel = "") {
  const total = Number(response?.totalModifier) || 0;
  const fixed = Number(fixedModifier) || 0;
  const entries = [];
  if (fixed) entries.push({ label: fixedModifierLabel || localize("GUM.TestRequest.GMModifier", "Modificador do Mestre"), value: fixed, valueLabel: `${fixed > 0 ? "+" : ""}${fixed}` });
  const remaining = total - fixed;
  if (remaining || !entries.length) entries.push({ label: localize("GUM.TestRequest.OtherModifiers", "Outros modificadores"), value: remaining, valueLabel: `${remaining > 0 ? "+" : ""}${remaining}` });
  return entries;
}

export function prepareResponseHistory(response) {
  const history = Array.isArray(response?.history) ? response.history : [];
  const previous = history.at(-1);
  return { hasHistory: history.length > 0, historyCount: history.length, previous: previous ? { ...previous, status: formatTestRequestStatus(previous) } : null };
}