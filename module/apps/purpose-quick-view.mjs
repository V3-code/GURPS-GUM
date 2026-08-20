import { ROLL_PURPOSES, ROLL_PURPOSE_GROUPS } from "../utils/roll-purposes.mjs";
import { expandRollTags, normalizeRollTags } from "../utils/roll-tags.mjs";

const BASE_LABELS = { ht: "HT", dx: "DX", iq: "IQ", st: "ST", per: "Percepção", vont: "Vontade", will: "Vontade" };
const ROLE_LABELS = { primary: "Finalidade principal", qualifier: "Qualificador" };
const GENERIC_TAGS = new Set(["test.resistance", "test.survival"]);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))];

export function getRollPurposeById(id, catalog = ROLL_PURPOSES) {
  return catalog.find(purpose => purpose.id === id) || null;
}

export function buildPurposeQuickView(id, { catalog = ROLL_PURPOSES, groups = ROLL_PURPOSE_GROUPS, expandTags = expandRollTags } = {}) {
  const purpose = getRollPurposeById(id, catalog);
  if (!purpose) return null;
  const directTags = normalizeRollTags(purpose.tags ?? purpose.rollTags);
  const directSet = new Set(directTags);
  const inheritedTags = unique(expandTags(directTags)).filter(tag => !directSet.has(tag));
  const configured = unique(purpose.recommendedFilterTags);
  const fallback = directTags.find(tag => !GENERIC_TAGS.has(tag)) || directTags[0];
  return {
    id: purpose.id,
    label: purpose.label,
    groupLabel: groups.find(group => group.id === purpose.group)?.label || purpose.group || "Outro",
    role: purpose.role || "primary",
    roleLabel: ROLE_LABELS[purpose.role] || "Finalidade principal",
    qualifierHint: purpose.role === "qualifier" ? "Qualificadores podem ser combinados com uma finalidade principal." : "",
    suggestedBases: unique(purpose.suggestedBases ?? purpose.suggestedAttributes).map(base => BASE_LABELS[base.toLowerCase()] || base.toUpperCase()),
    description: String(purpose.description || `Use esta finalidade quando o teste representar ${purpose.label.toLocaleLowerCase("pt-BR")}.`),
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
const badges = tags => tags.map(tag => `<span class="purpose-tag"><code>${escapeHtml(tag)}</code><button type="button" class="purpose-copy-tag" data-tag="${escapeHtml(tag)}" title="Copiar tag" aria-label="Copiar tag ${escapeHtml(tag)}"><i class="fas fa-copy"></i></button></span>`).join("");

export function buildPurposeQuickViewContent(view) {
  const bases = view.suggestedBases.length ? `<div><b>${view.suggestedBases.length === 1 ? "Base comum" : "Bases comuns"}:</b> ${view.suggestedBases.join(" ou ")}</div><p class="purpose-base-note">A base é apenas uma sugestão. O GUM não limita esta finalidade a um atributo ou habilidade específica.</p>` : "";
  const section = (title, body, className = "") => body ? `<section class="${className}"><h4>${title}</h4>${body}</section>` : "";
  return `<div class="gurps-dialog-canvas gum-preview-canvas gum-purpose-preview-canvas"><article class="gurps-item-preview-card gum-preview-card gum-purpose-preview-card gum-purpose-quick-view"><header class="preview-header gum-purpose-preview-header"><div class="header-text"><h3>${escapeHtml(view.label)}</h3><span class="preview-item-type">Finalidade do Teste</span></div></header><section class="preview-content gum-purpose-preview-content"><div class="purpose-facts"><div><b>Grupo:</b> ${escapeHtml(view.groupLabel)}</div><div><b>Tipo:</b> ${escapeHtml(view.roleLabel)}</div>${bases}${view.qualifierHint ? `<p>${escapeHtml(view.qualifierHint)}</p>` : ""}</div>${section("Quando usar", `<p>${escapeHtml(view.description)}</p>`)}${section("Não confundir com", view.distinctions.length ? `<ul>${view.distinctions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "")}${section("Tag recomendada para efeitos", badges(view.recommendedFilterTags))}${section("Tags específicas produzidas", badges(view.directTags))}${view.inheritedTags.length ? `<details><summary>Categorias herdadas</summary>${badges(view.inheritedTags)}</details>` : ""}<p class="purpose-tag-help">Tags específicas restringem o modificador a esta finalidade ou a uma situação muito próxima. Categorias herdadas também podem alcançar outras finalidades relacionadas.</p>${section("Referência", view.references.map(escapeHtml).join("<br>"), "purpose-references")}</section></article></div>`;
}

export function calculatePurposePreviewHeight(headerHeight, contentHeight, viewportHeight) {
  const naturalHeight = Math.ceil(Math.max(0, headerHeight) + Math.max(0, contentHeight) + 2);
  return Math.min(naturalHeight, Math.floor(Math.max(0, viewportHeight) * 0.75));
}

export class PurposeQuickView {
  static current = null;

  static show(id) {
    const view = buildPurposeQuickView(id);
    if (!view) { console.warn(`GUM | Finalidade desconhecida: ${id}`); return null; }
    this.current?.close();
    const content = buildPurposeQuickViewContent(view);
    let fittedInitialHeight = false;
    const dialog = new Dialog({
      title: `Finalidade: ${view.label}`,
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
          try { if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível"); await navigator.clipboard.writeText(tag); ui.notifications.info(`Tag copiada: ${tag}`); }
          catch (error) { console.warn("GUM | Não foi possível copiar a tag", error); ui.notifications?.warn("Não foi possível copiar a tag."); }
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