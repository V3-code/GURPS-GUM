const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

export function normalizeContextCsv(value, options = []) {
  const validIds = new Set(options.map(option => option.id));
  const parts = String(value ?? "").split(",").map(part => part.trim()).filter(Boolean);
  const valid = [...new Set(parts.filter(part => validIds.has(part)))];
  if (!valid.length || valid.includes("all")) return "all";
  return valid.join(",");
}

export function readSelectedContexts(dialogHtml) {
  const root = dialogHtml?.[0] ?? dialogHtml;
  if (root?.querySelectorAll) {
    return [...root.querySelectorAll('input[name="ctx"]:checked')].map(input => input.value);
  }
  if (typeof dialogHtml?.find === "function") {
    const result = dialogHtml.find('input[name="ctx"]:checked');
    const inputs = typeof result?.toArray === "function" ? result.toArray() : [...(result ?? [])];
    return inputs.map(input => input.value);
  }
  return [];
}

export function applyContextsToInput(input, contexts, options = []) {
  if (!input) return;
  input.value = normalizeContextCsv(contexts, options);
  const EventConstructor = input.ownerDocument?.defaultView?.Event ?? globalThis.Event;
  input.dispatchEvent(new EventConstructor("input", { bubbles: true }));
  input.dispatchEvent(new EventConstructor("change", { bubbles: true }));
}

export function openContextPicker({ input, options, title = "Selecionar Contextos" }) {
  if (!input) return null;
  const selected = new Set(normalizeContextCsv(input.value, options).split(","));
  const content = `<div class="gum-context-picker">
    <p class="gum-context-picker-intro">Escolha onde este modificador deve ser aplicado.</p>
    <div class="gum-context-picker-options">${options.map(option => `
      <label class="gum-context-picker-option${selected.has(option.id) ? " is-selected" : ""}">
        <input type="checkbox" name="ctx" value="${escapeHtml(option.id)}" ${selected.has(option.id) ? "checked" : ""}>
        <span class="gum-context-picker-check" aria-hidden="true"><i class="fas fa-check"></i></span>
        <span class="gum-context-picker-copy"><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.id)}</small></span>
      </label>`).join("")}</div>
  </div>`;

  const dialog = new Dialog({
    title,
    content,
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Aplicar",
        callback: dialogHtml => applyContextsToInput(input, readSelectedContexts(dialogHtml).join(","), options)
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" }
    },
    default: "apply",
    render: dialogHtml => {
      const root = dialogHtml?.[0] ?? dialogHtml;
      root?.querySelectorAll?.('input[name="ctx"]').forEach(checkbox => {
        checkbox.addEventListener("change", () => {
          if (checkbox.value === "all" && checkbox.checked) {
            root.querySelectorAll('input[name="ctx"]:not([value="all"])').forEach(other => { other.checked = false; other.closest("label")?.classList.remove("is-selected"); });
          } else if (checkbox.checked) {
            const all = root.querySelector('input[name="ctx"][value="all"]');
            if (all) { all.checked = false; all.closest("label")?.classList.remove("is-selected"); }
          }
          checkbox.closest("label")?.classList.toggle("is-selected", checkbox.checked);
        });
      });
    }
  }, { classes: ["gum-context-picker-window"] });
  return dialog.render(true);
}