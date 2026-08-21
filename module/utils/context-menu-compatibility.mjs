export function normalizeContextMenuEntries(entries = []) {
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    if (entry.label === undefined && entry.name !== undefined) entry.label = entry.name;
    if (entry.visible === undefined && entry.condition !== undefined) entry.visible = entry.condition;
    if (entry.onClick === undefined && entry.callback !== undefined) entry.onClick = entry.callback;

    delete entry.name;
    delete entry.condition;
    delete entry.callback;
  }

  return entries;
}

export function registerContextMenuCompatibilityHooks({ Hooks, generation }) {
  if (Number(generation) < 14) return;

  const normalize = (_html, entries) => normalizeContextMenuEntries(entries);
  Hooks.on("getActorDirectoryEntryContext", normalize);
  Hooks.on("getCompendiumDirectoryEntryContext", normalize);
}