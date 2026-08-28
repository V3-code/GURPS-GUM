import { getGroupedRollPurposes, getPurposeLabels, normalizePurposeIds, normalizePurposeSearch } from "../utils/roll-purposes.mjs";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const resolveI18n = i18n => i18n ?? globalThis.game?.i18n ?? null;
const text = (i18n, key, fallback) => {
  const value = resolveI18n(i18n)?.localize?.(key);
  return value && value !== key ? value : fallback;
};
const formatted = (i18n, key, data, fallback) => {
  const value = resolveI18n(i18n)?.format?.(key, data);
  return value && value !== key ? value : fallback;
};

export function formatPurposeSelection(ids = [], { i18n } = {}) {
  const labels = getPurposeLabels(ids, { i18n });
  return labels.length ? labels.join(", ") : text(i18n, "GUM.RollPurposes.GeneralTest", "General Test");
}

/** Build the shared purpose selector used by resistance and effect-chat tests. */
export function buildRollPurposePickerContent({ selectedIds = [], attributeKey = null, idPrefix = `gum-purpose-picker-${Date.now()}`, i18n } = {}) {
  const selected = normalizePurposeIds(selectedIds);
  let optionIndex = 0;
  const groups = getGroupedRollPurposes(attributeKey, selected, "", { i18n })
    .filter(group => group.id !== "general")
    .map(group => {
      const options = group.purposes.map(purpose => {
        const checkboxId = `${idPrefix}-${optionIndex++}`;
        const search = normalizePurposeSearch(`${purpose.label} ${purpose.id} ${purpose.description} ${(purpose.keywords ?? []).join(" ")}`);
        return `<div class="roll-tag-picker-option${purpose.selected ? " is-selected" : ""}" data-search="${escapeHtml(search)}" tabindex="0">
          <input id="${checkboxId}" type="checkbox" name="roll-purpose" value="${escapeHtml(purpose.id)}" ${purpose.selected ? "checked" : ""}>
          <label for="${checkboxId}"><span class="gum-purpose-picker-title"><strong>${escapeHtml(purpose.label)}</strong>${purpose.suggested ? `<span class="gum-purpose-suggested">${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.Suggested", "Suggested"))}</span>` : ""}</span><code>${escapeHtml(purpose.id)}</code></label>
          <button type="button" class="roll-tag-picker-info" aria-label="${escapeHtml(formatted(i18n, "GUM.RollPurposes.Picker.InformationAbout", { label: purpose.label }, `Information about ${purpose.label}`))}" aria-expanded="false"><i class="fas fa-info-circle" aria-hidden="true"></i><span role="tooltip">${escapeHtml(purpose.description)}</span></button>
        </div>`;
      }).join("");
      const selectedCount = group.purposes.filter(purpose => purpose.selected).length;
      return `<details class="roll-tag-picker-group" data-group="${escapeHtml(group.id)}" ${selectedCount ? "open" : ""}><summary><span>${escapeHtml(group.label)}</span><span class="roll-tag-group-count"><b>${selectedCount}</b>/${group.purposes.length}</span></summary><div class="roll-tag-group-options">${options}</div></details>`;
    }).join("");

  return `<div class="gum-roll-tag-picker gum-purpose-picker">
    <div class="roll-tag-picker-searchbox"><i class="fas fa-search" aria-hidden="true"></i><input type="search" class="roll-tag-picker-search" placeholder="${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.SearchPlaceholder", "Search purposes by name, key, or description..."))}" aria-label="${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.SearchAria", "Search purposes"))}"><button type="button" class="roll-tag-search-clear" aria-label="${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.ClearSearch", "Clear search"))}"><i class="fas fa-times" aria-hidden="true"></i></button></div>
    <div class="roll-tag-picker-tools"><strong class="roll-tag-selected-summary"></strong><button type="button" class="roll-tag-clear-selection">${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.Clear", "Clear"))}</button><label><input type="checkbox" class="roll-tag-selected-only"> ${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.SelectedOnly", "Show selected only"))}</label><span class="roll-tag-result-count" aria-live="polite"></span></div>
    <div class="roll-tag-picker-results">${groups}<div class="roll-tag-picker-empty" hidden><strong>${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.NoResults", "No purposes found."))}</strong><span>${escapeHtml(text(i18n, "GUM.RollPurposes.Picker.NoResultsHint", "Try another term or disable the selected-only filter."))}</span></div></div>
  </div>`;
}

export function openRollPurposePicker({ selectedIds = [], attributeKey = null, onApply, i18n = globalThis.game?.i18n } = {}) {
  new Dialog({
    title: text(i18n, "GUM.RollPurposes.Picker.Title", "Select Test Purposes"),
    content: buildRollPurposePickerContent({ selectedIds, attributeKey, i18n }),
    render: html => {
      const root = html.find(".gum-purpose-picker");
      const windowElement = root.closest(".window-app").addClass("gum-roll-tag-picker-window");
      windowElement.find(".window-header .close").attr({ title: text(i18n, "GUM.RollPurposes.Picker.Close", "Close"), "aria-label": text(i18n, "GUM.RollPurposes.Picker.Close", "Close") });
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
        root.find(".roll-tag-selected-summary").text(count ? formatted(i18n, count === 1 ? "GUM.RollPurposes.Picker.SelectedOne" : "GUM.RollPurposes.Picker.SelectedMany", { count }, `${count} ${count === 1 ? "purpose selected" : "purposes selected"}`) : text(i18n, "GUM.RollPurposes.GeneralTest", "General Test"));
        root.find(".roll-tag-result-count").text(formatted(i18n, visibleCount === 1 ? "GUM.RollPurposes.Picker.ResultOne" : "GUM.RollPurposes.Picker.ResultMany", { count: visibleCount }, `${visibleCount} ${visibleCount === 1 ? "result" : "results"}`));
        root.find(".roll-tag-picker-empty").prop("hidden", visibleCount !== 0);
        const applyLabel = count ? formatted(i18n, count === 1 ? "GUM.RollPurposes.Picker.ApplyOne" : "GUM.RollPurposes.Picker.ApplyMany", { count }, `Apply ${count} ${count === 1 ? "purpose" : "purposes"}`) : text(i18n, "GUM.RollPurposes.Picker.ApplyGeneral", "Apply as General Test");
        windowElement.find('[data-button="apply"]').html(`<i class="fas fa-check"></i> ${escapeHtml(applyLabel)}`);
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
      apply: { icon: '<i class="fas fa-check"></i>', label: text(i18n, "GUM.RollPurposes.Picker.Apply", "Apply"), callback: html => onApply?.(normalizePurposeIds(html.find('input[name="roll-purpose"]:checked').toArray().map(input => input.value))) },
      cancel: { icon: '<i class="fas fa-times"></i>', label: text(i18n, "GUM.RollPurposes.Picker.Cancel", "Cancel") }
    },
    default: "apply"
  }, { width: 740 }).render(true);
}
