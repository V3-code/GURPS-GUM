import { getGroupedRollPurposes, getPurposeLabels, normalizePurposeIds, normalizePurposeSearch } from "../utils/roll-purposes.mjs";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function formatPurposeSelection(ids = []) {
  const labels = getPurposeLabels(ids);
  return labels.length ? labels.join(", ") : "Teste Geral";
}

/** Build the shared purpose selector used by resistance and effect-chat tests. */
export function buildRollPurposePickerContent({ selectedIds = [], attributeKey = null, idPrefix = `gum-purpose-picker-${Date.now()}` } = {}) {
  const selected = normalizePurposeIds(selectedIds);
  let optionIndex = 0;
  const groups = getGroupedRollPurposes(attributeKey, selected)
    .filter(group => group.id !== "general")
    .map(group => {
      const options = group.purposes.map(purpose => {
        const checkboxId = `${idPrefix}-${optionIndex++}`;
        const search = normalizePurposeSearch(`${purpose.label} ${purpose.id} ${purpose.description} ${(purpose.keywords ?? []).join(" ")}`);
        return `<div class="roll-tag-picker-option${purpose.selected ? " is-selected" : ""}" data-search="${escapeHtml(search)}" tabindex="0">
          <input id="${checkboxId}" type="checkbox" name="roll-purpose" value="${escapeHtml(purpose.id)}" ${purpose.selected ? "checked" : ""}>
          <label for="${checkboxId}"><span class="gum-purpose-picker-title"><strong>${escapeHtml(purpose.label)}</strong>${purpose.suggested ? '<span class="gum-purpose-suggested">Sugerida</span>' : ""}</span><code>${escapeHtml(purpose.id)}</code></label>
          <button type="button" class="roll-tag-picker-info" aria-label="Informações sobre ${escapeHtml(purpose.label)}" aria-expanded="false"><i class="fas fa-info-circle" aria-hidden="true"></i><span role="tooltip">${escapeHtml(purpose.description)}</span></button>
        </div>`;
      }).join("");
      const selectedCount = group.purposes.filter(purpose => purpose.selected).length;
      return `<details class="roll-tag-picker-group" data-group="${escapeHtml(group.id)}" ${selectedCount ? "open" : ""}><summary><span>${escapeHtml(group.label)}</span><span class="roll-tag-group-count"><b>${selectedCount}</b>/${group.purposes.length}</span></summary><div class="roll-tag-group-options">${options}</div></details>`;
    }).join("");

  return `<div class="gum-roll-tag-picker gum-purpose-picker">
    <div class="roll-tag-picker-searchbox"><i class="fas fa-search" aria-hidden="true"></i><input type="search" class="roll-tag-picker-search" placeholder="Buscar finalidade por nome, chave ou descrição..." aria-label="Buscar finalidades"><button type="button" class="roll-tag-search-clear" aria-label="Limpar pesquisa"><i class="fas fa-times" aria-hidden="true"></i></button></div>
    <div class="roll-tag-picker-tools"><strong class="roll-tag-selected-summary"></strong><button type="button" class="roll-tag-clear-selection">Limpar</button><label><input type="checkbox" class="roll-tag-selected-only"> Mostrar somente selecionadas</label><span class="roll-tag-result-count" aria-live="polite"></span></div>
    <div class="roll-tag-picker-results">${groups}<div class="roll-tag-picker-empty" hidden><strong>Nenhuma finalidade encontrada.</strong><span>Tente outro termo ou desative o filtro de selecionadas.</span></div></div>
  </div>`;
}

export function openRollPurposePicker({ selectedIds = [], attributeKey = null, onApply } = {}) {
  new Dialog({
    title: "Selecionar finalidades do teste",
    content: buildRollPurposePickerContent({ selectedIds, attributeKey }),
    render: html => {
      const root = html.find(".gum-purpose-picker");
      const windowElement = root.closest(".window-app").addClass("gum-roll-tag-picker-window");
      windowElement.find(".window-header .close").attr({ title: "Fechar", "aria-label": "Fechar" });
      const search = root.find(".roll-tag-picker-search");
      let expansionBeforeFilter = null;
      const refresh = () => {
        const query = normalizePurposeSearch(search.val());
        const selectedOnly = root.find(".roll-tag-selected-only").prop("checked");
        const filtering = Boolean(query || selectedOnly);
        if (filtering && !expansionBeforeFilter) expansionBeforeFilter = root.find(".roll-tag-picker-group").toArray().map(group => group.open);
        let visibleCount = 0;
        root.find(".roll-tag-picker-group").each((_groupIndex, group) => {
          let groupVisible = 0;
          let groupSelected = 0;
          $(group).find(".roll-tag-picker-option").each((_optionIndex, option) => {
            const checked = $(option).find('input[name="roll-purpose"]').prop("checked");
            groupSelected += checked ? 1 : 0;
            option.hidden = Boolean((query && !option.dataset.search.includes(query)) || (selectedOnly && !checked));
            groupVisible += option.hidden ? 0 : 1;
          });
          group.hidden = filtering && groupVisible === 0;
          if (filtering && groupVisible) group.open = true;
          $(group).find(".roll-tag-group-count b").text(groupSelected);
          visibleCount += groupVisible;
        });
        if (!filtering && expansionBeforeFilter) {
          root.find(".roll-tag-picker-group").each((index, group) => { group.open = expansionBeforeFilter[index]; });
          expansionBeforeFilter = null;
        }
        const count = root.find('input[name="roll-purpose"]:checked').length;
        root.find(".roll-tag-selected-summary").text(count ? `${count} ${count === 1 ? "finalidade selecionada" : "finalidades selecionadas"}` : "Teste Geral");
        root.find(".roll-tag-result-count").text(`${visibleCount} ${visibleCount === 1 ? "resultado" : "resultados"}`);
        root.find(".roll-tag-picker-empty").prop("hidden", visibleCount !== 0);
        windowElement.find('[data-button="apply"]').html(`<i class="fas fa-check"></i> ${count ? `Aplicar ${count} ${count === 1 ? "finalidade" : "finalidades"}` : "Aplicar como Teste Geral"}`);
      };
      root.on("input", ".roll-tag-picker-search", refresh);
      root.on("change", ".roll-tag-selected-only", refresh);
      root.on("change", 'input[name="roll-purpose"]', event => { $(event.currentTarget).closest(".roll-tag-picker-option").toggleClass("is-selected", event.currentTarget.checked); refresh(); });
      root.on("click", ".roll-tag-search-clear", () => search.val("").trigger("input").trigger("focus"));
      root.on("click", ".roll-tag-clear-selection", () => root.find('input[name="roll-purpose"]').prop("checked", false).trigger("change"));
      root.on("click", ".roll-tag-picker-option", event => { if ($(event.target).is("input, label, label *, button, button *")) return; $(event.currentTarget).find("input").trigger("click"); });
      root.on("keydown", ".roll-tag-picker-option", event => { if (event.key === " " && event.target === event.currentTarget) { event.preventDefault(); $(event.currentTarget).find("input").trigger("click"); } });
      root.on("click", ".roll-tag-picker-info", event => { event.stopPropagation(); const button = $(event.currentTarget); button.attr("aria-expanded", button.attr("aria-expanded") !== "true" ? "true" : "false"); });
      search.on("keydown", event => {
        if (event.key === "Escape" && search.val()) { event.preventDefault(); event.stopPropagation(); search.val("").trigger("input"); }
        if (event.key === "Enter") { const visible = root.find(".roll-tag-picker-option:visible"); if (visible.length === 1) { event.preventDefault(); visible.find("input").trigger("click"); } }
      });
      refresh();
      search.trigger("focus");
    },
    buttons: {
      apply: { icon: '<i class="fas fa-check"></i>', label: "Aplicar", callback: html => onApply?.(normalizePurposeIds(html.find('input[name="roll-purpose"]:checked').toArray().map(input => input.value))) },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" }
    },
    default: "apply"
  }, { width: 740 }).render(true);
}