import { getGroupedRollPurposes, getPurposeLabels, normalizePurposeIds, normalizePurposeSearch } from "../utils/roll-purposes.mjs";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function formatPurposeSelection(ids = []) {
  const labels = getPurposeLabels(ids);
  return labels.length ? labels.join(", ") : "Teste Geral";
}

export function openRollPurposePicker({ selectedIds = [], attributeKey = null, onApply } = {}) {
  const selected = normalizePurposeIds(selectedIds);
  let optionIndex = 0;
  const groups = getGroupedRollPurposes(attributeKey, selected).filter(group => group.id !== "general").map(group => {
    const options = group.purposes.map(purpose => {
      const id = `gum-purpose-picker-${Date.now()}-${optionIndex++}`;
      const search = normalizePurposeSearch(`${purpose.label} ${purpose.id} ${purpose.description} ${(purpose.keywords ?? []).join(" ")}`);
      return `<div class="roll-tag-picker-option${purpose.selected ? " is-selected" : ""}" data-search="${escapeHtml(search)}" tabindex="0">
        <input id="${id}" type="checkbox" name="roll-purpose" value="${escapeHtml(purpose.id)}" ${purpose.selected ? "checked" : ""}>
        <label for="${id}"><strong>${escapeHtml(purpose.label)}</strong>${purpose.suggested ? '<span class="gum-purpose-suggested">Sugerida</span>' : ""}<small>${escapeHtml(purpose.description)}</small></label>
      </div>`;
    }).join("");
    const count = group.purposes.filter(purpose => purpose.selected).length;
    return `<details class="roll-tag-picker-group" ${count ? "open" : ""}><summary><span>${escapeHtml(group.label)}</span><span class="roll-tag-group-count"><b>${count}</b>/${group.purposes.length}</span></summary><div class="roll-tag-group-options">${options}</div></details>`;
  }).join("");

  new Dialog({
    title: "Selecionar finalidades do teste",
    content: `<div class="gum-roll-tag-picker gum-purpose-picker">
      <div class="roll-tag-picker-searchbox"><i class="fas fa-search"></i><input type="search" class="roll-tag-picker-search" placeholder="Buscar finalidade por nome ou descrição..."><button type="button" class="roll-tag-search-clear"><i class="fas fa-times"></i></button></div>
      <div class="roll-tag-picker-tools"><strong class="roll-tag-selected-summary"></strong><button type="button" class="roll-tag-clear-selection">Limpar</button><span class="roll-tag-result-count"></span></div>
      <div class="roll-tag-picker-results">${groups}<div class="roll-tag-picker-empty" hidden>Nenhuma finalidade encontrada.</div></div>
    </div>`,
    render: html => {
      const root = html.find(".gum-purpose-picker");
      const refresh = () => {
        const query = normalizePurposeSearch(root.find(".roll-tag-picker-search").val());
        let visible = 0;
        root.find(".roll-tag-picker-group").each((_groupIndex, group) => {
          let groupVisible = 0;
          let groupSelected = 0;
          $(group).find(".roll-tag-picker-option").each((_optionIndex, option) => {
            const checked = $(option).find('input[name="roll-purpose"]').prop("checked");
            option.hidden = Boolean(query && !option.dataset.search.includes(query));
            groupVisible += option.hidden ? 0 : 1;
            groupSelected += checked ? 1 : 0;
          });
          group.hidden = groupVisible === 0;
          if (query && groupVisible) group.open = true;
          $(group).find(".roll-tag-group-count b").text(groupSelected);
          visible += groupVisible;
        });
        const count = root.find('input[name="roll-purpose"]:checked').length;
        root.find(".roll-tag-selected-summary").text(count ? `${count} selecionada${count === 1 ? "" : "s"}` : "Teste Geral");
        root.find(".roll-tag-result-count").text(`${visible} resultado${visible === 1 ? "" : "s"}`);
        root.find(".roll-tag-picker-empty").prop("hidden", visible !== 0);
      };
      root.on("input", ".roll-tag-picker-search", refresh);
      root.on("change", 'input[name="roll-purpose"]', event => { $(event.currentTarget).closest(".roll-tag-picker-option").toggleClass("is-selected", event.currentTarget.checked); refresh(); });
      root.on("click", ".roll-tag-search-clear", () => root.find(".roll-tag-picker-search").val("").trigger("input").trigger("focus"));
      root.on("click", ".roll-tag-clear-selection", () => root.find('input[name="roll-purpose"]').prop("checked", false).trigger("change"));
      root.on("click", ".roll-tag-picker-option", event => { if ($(event.target).is("input, label, label *")) return; $(event.currentTarget).find("input").trigger("click"); });
      refresh();
      root.find(".roll-tag-picker-search").trigger("focus");
    },
    buttons: {
      apply: { icon: '<i class="fas fa-check"></i>', label: "Aplicar", callback: html => onApply?.(normalizePurposeIds(html.find('input[name="roll-purpose"]:checked').toArray().map(input => input.value))) },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" }
    },
    default: "apply"
  }, { width: 740 }).render(true);
}