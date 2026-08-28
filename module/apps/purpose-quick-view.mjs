import { ROLL_PURPOSES, ROLL_PURPOSE_GROUPS, localizeRollPurpose, localizeRollPurposeGroup } from "../utils/roll-purposes.mjs";
import { expandRollTags, normalizeRollTags } from "../utils/roll-tags.mjs";

const BASE_LABEL_KEYS = { per: "GUM.RollPurposes.QuickView.Perception", vont: "GUM.RollPurposes.QuickView.Will", will: "GUM.RollPurposes.QuickView.Will" };
const GENERIC_TAGS = new Set(["test.resistance", "test.survival"]);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))];
const resolveI18n = i18n => i18n ?? globalThis.game?.i18n ?? null;
const text = (i18n, key, fallback) => { const value = resolveI18n(i18n)?.localize?.(key); return value && value !== key ? value : fallback; };
const formatted = (i18n, key, data, fallback) => { const value = resolveI18n(i18n)?.format?.(key, data); return value && value !== key ? value : fallback; };

export function getRollPurposeById(id, catalog = ROLL_PURPOSES) {
  return catalog.find(purpose => purpose.id === id) || null;
}

export function buildPurposeQuickView(id, { catalog = ROLL_PURPOSES, groups = ROLL_PURPOSE_GROUPS, expandTags = expandRollTags, i18n } = {}) {
  const rawPurpose = getRollPurposeById(id, catalog);
  if (!rawPurpose) return null;
  const purpose = localizeRollPurpose(rawPurpose, { i18n });
  const directTags = normalizeRollTags(purpose.tags ?? purpose.rollTags);
  const directSet = new Set(directTags);
  const inheritedTags = unique(expandTags(directTags)).filter(tag => !directSet.has(tag));
  const configured = unique(purpose.recommendedFilterTags);
  const fallback = directTags.find(tag => !GENERIC_TAGS.has(tag)) || directTags[0];
  return {
    id: purpose.id,
    label: purpose.label,
    groupLabel: localizeRollPurposeGroup(groups.find(group => group.id === purpose.group), { i18n })?.label || purpose.group || text(i18n, "GUM.RollPurposes.QuickView.Other", "Other"),
    role: purpose.role || "primary",
    roleLabel: text(i18n, purpose.role === "qualifier" ? "GUM.RollPurposes.QuickView.Qualifier" : "GUM.RollPurposes.QuickView.Primary", purpose.role === "qualifier" ? "Qualifier" : "Primary Purpose"),
    qualifierHint: purpose.role === "qualifier" ? text(i18n, "GUM.RollPurposes.QuickView.QualifierHint", "Qualifiers can be combined with a primary purpose.") : "",
    suggestedBases: unique(purpose.suggestedBases ?? purpose.suggestedAttributes).map(base => BASE_LABEL_KEYS[base.toLowerCase()] ? text(i18n, BASE_LABEL_KEYS[base.toLowerCase()], base === "per" ? "Perception" : "Will") : base.toUpperCase()),
    description: String(purpose.description || formatted(i18n, "GUM.RollPurposes.GenericDescription", { label: purpose.label.toLocaleLowerCase(resolveI18n(i18n)?.lang || undefined) }, `Use this purpose when the test represents ${purpose.label.toLocaleLowerCase("en")}.`)),
    distinctions: unique(purpose.distinctions),
    recommendedFilterTags: configured.length ? configured : (fallback ? [fallback] : []),
    directTags,
    inheritedTags,
    references: unique(purpose.references)
  };
}

const escapeHtml = value => globalThis.foundry?.utils?.escapeHTML
  ? foundry.utils.escapeHTML(String(value ?? ""))
  : String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const badges = (tags, i18n) => tags.map(tag => `<span class="purpose-tag"><code>${escapeHtml(tag)}</code><button type="button" class="purpose-copy-tag" data-tag="${escapeHtml(tag)}" title="${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.CopyTag", "Copy tag"))}" aria-label="${escapeHtml(formatted(i18n, "GUM.RollPurposes.QuickView.CopyTagAria", { tag }, `Copy tag ${tag}`))}"><i class="fas fa-copy"></i></button></span>`).join("");

export function buildPurposeQuickViewContent(view, { i18n } = {}) {
  const bases = view.suggestedBases.length ? `<div><b>${text(i18n, view.suggestedBases.length === 1 ? "GUM.RollPurposes.QuickView.CommonBase" : "GUM.RollPurposes.QuickView.CommonBases", view.suggestedBases.length === 1 ? "Common base" : "Common bases")}:</b> ${view.suggestedBases.join(` ${text(i18n, "GUM.RollPurposes.QuickView.Or", "or")} `)}</div><p class="purpose-base-note">${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.BaseHint", "The base is only a suggestion. GUM does not limit this purpose to a specific attribute or ability."))}</p>` : "";
  const section = (title, body, className = "") => body ? `<section class="${className}"><h4>${title}</h4>${body}</section>` : "";
  return `<div class="gurps-dialog-canvas gum-preview-canvas gum-purpose-preview-canvas"><article class="gurps-item-preview-card gum-preview-card gum-purpose-preview-card gum-purpose-quick-view"><header class="preview-header gum-purpose-preview-header"><div class="header-text"><h3>${escapeHtml(view.label)}</h3><span class="preview-item-type">${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.Type", "Test Purpose"))}</span></div></header><section class="preview-content gum-purpose-preview-content"><div class="purpose-facts"><div><b>${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.Group", "Group"))}:</b> ${escapeHtml(view.groupLabel)}</div><div><b>${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.Role", "Type"))}:</b> ${escapeHtml(view.roleLabel)}</div>${bases}${view.qualifierHint ? `<p>${escapeHtml(view.qualifierHint)}</p>` : ""}</div>${section(text(i18n, "GUM.RollPurposes.QuickView.WhenToUse", "When to Use"), `<p>${escapeHtml(view.description)}</p>`)}${section(text(i18n, "GUM.RollPurposes.QuickView.DoNotConfuse", "Do Not Confuse With"), view.distinctions.length ? `<ul>${view.distinctions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "")}${section(text(i18n, "GUM.RollPurposes.QuickView.RecommendedTag", "Recommended Effect Tag"), badges(view.recommendedFilterTags, i18n))}${section(text(i18n, "GUM.RollPurposes.QuickView.DirectTags", "Specific Tags Produced"), badges(view.directTags, i18n))}${view.inheritedTags.length ? `<details><summary>${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.InheritedCategories", "Inherited Categories"))}</summary>${badges(view.inheritedTags, i18n)}</details>` : ""}<p class="purpose-tag-help">${escapeHtml(text(i18n, "GUM.RollPurposes.QuickView.TagHint", "Specific tags restrict the modifier to this purpose or a closely related situation. Inherited categories can also reach other related purposes."))}</p>${section(text(i18n, "GUM.RollPurposes.QuickView.Reference", "Reference"), view.references.map(escapeHtml).join("<br>"), "purpose-references")}</section></article></div>`;
}

export function calculatePurposePreviewHeight(headerHeight, contentHeight, viewportHeight) {
  const naturalHeight = Math.ceil(Math.max(0, headerHeight) + Math.max(0, contentHeight) + 2);
  return Math.min(naturalHeight, Math.floor(Math.max(0, viewportHeight) * 0.75));
}

export class PurposeQuickView {
  static current = null;

  static show(id) {
    const i18n = globalThis.game?.i18n;
    const view = buildPurposeQuickView(id, { i18n });
    if (!view) { console.warn(formatted(i18n, "GUM.RollPurposes.QuickView.UnknownPurpose", { id }, `GUM | Unknown purpose: ${id}`)); return null; }
    this.current?.close();
    const content = buildPurposeQuickViewContent(view, { i18n });
    let fittedInitialHeight = false;
    const dialog = new Dialog({
      title: formatted(i18n, "GUM.RollPurposes.QuickView.Title", { label: view.label }, `Purpose: ${view.label}`),
      content,
      buttons: {},
      close: () => { this.current = null; },
      render: html => {
        // O template padrão do Dialog mantém um rodapé vazio mesmo sem botões.
        // Removê-lo antes da medição evita que a região flexível infle a janela.
        html.find(".dialog-buttons").remove();
        html.find(".purpose-copy-tag").on("click", async event => {
          event.preventDefault(); event.stopPropagation();
          const tag = event.currentTarget.dataset.tag;
          try { if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(tag); ui.notifications.info(formatted(i18n, "GUM.RollPurposes.QuickView.TagCopied", { tag }, `Tag copied: ${tag}`)); }
          catch (error) { console.warn("GUM | Could not copy purpose tag", error); ui.notifications?.warn(text(i18n, "GUM.RollPurposes.QuickView.CopyFailure", "Could not copy the tag.")); }
        });
        const windowRoot = html.closest(".app.window-app, .window-app, .dialog");
        windowRoot.addClass("gurps-item-preview-dialog gum-premium-preview-dialog gum-purpose-preview-dialog");
        if (!fittedInitialHeight) {
          fittedInitialHeight = true;
          requestAnimationFrame(() => {
            const headerHeight = windowRoot.find(".window-header").outerHeight(true) || 0;
            // scrollHeight representa o conteúdo real mesmo quando o layout flexível do
            // Dialog já esticou o card para preencher a altura padrão da janela.
            const canvas = html.find(".gum-purpose-preview-canvas")[0];
            const contentHeight = canvas?.scrollHeight || html.find(".gum-purpose-preview-card").outerHeight(true) || 0;
            dialog.setPosition({ height: calculatePurposePreviewHeight(headerHeight, contentHeight, window.innerHeight) });
          });
        }
      }
    }, { classes: ["gurps-item-preview-dialog", "gum-premium-preview-dialog", "gum-purpose-preview-dialog"], width: 520, height: "auto", resizable: true });
    this.current = dialog;
    dialog.render(true);
    return dialog;
  }
}
