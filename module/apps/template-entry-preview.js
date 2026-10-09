import { GumPreviewDialog } from "./preview-dialog.js";
import { templateEntryDisplayName } from "../utils/template-entry-display.mjs";

export async function showTemplateEntryPreview(entry, { actor = null, sourceItem = null } = {}) {
  const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
  const title = templateEntryDisplayName(entry, sourceItem) || game.i18n.localize("GUM.Template.Item");
  const source = sourceItem || entry.inlineItem;
  if ((entry.kind === "item" || (entry.itemType && !entry.kind)) && source?.type) {
    const preview = {
      name: title,
      type: source.type,
      img: entry.img || source.img,
      uuid: sourceItem?.uuid || "",
      system: { ...(source.system || {}) }
    };
    if (entry.specialization) preview.system.specialization = entry.specialization;
    if (entry.ref && !preview.system.ref) preview.system.ref = entry.ref;
    if (["skill", "spell", "power"].includes(source.type) && entry.level !== "" && entry.level !== null && entry.level !== undefined) {
      preview.system.skill_level = Number(entry.level);
    }
    if (["advantage", "disadvantage"].includes(source.type) && entry.level !== "" && entry.level !== null && entry.level !== undefined) {
      preview.system.level = Number(entry.level);
    }
    if (entry.cost !== undefined) {
      if (["skill", "spell", "advantage", "disadvantage"].includes(source.type)) preview.system.points = Number(entry.cost) || 0;
      if (source.type === "power") preview.system.points_skill = Number(entry.cost) || 0;
      if (source.type === "equipment") preview.system.cost = Number(entry.cost) || 0;
    }
    if (source.type === "equipment") preview.system.quantity = entry.quantity ?? preview.system.quantity;
    return GumPreviewDialog.showItem(preview, { actor, sendToChat: false });
  }

  const blocks = entry.subBlocks?.length ? entry.subBlocks : sourceItem?.system?.blocks || [];
  const blockSummary = blocks.map(block => `<li><strong>${esc(block.title || game.i18n.localize("GUM.Template.Block"))}</strong>: ${(block.contents || [])
    .map(option => esc(templateEntryDisplayName(option) || game.i18n.localize("GUM.Template.Item"))).join(", ")}</li>`).join("");
  const rawDescription = sourceItem?.system?.description || entry.localNotes || entry.inlineItem?.system?.description || "";
  const description = `${rawDescription ? await GumPreviewDialog.enrichDescription(rawDescription) : ""}${blockSummary ? `<ul>${blockSummary}</ul>` : ""}`
    || await GumPreviewDialog.enrichDescription("");
  const tags = [];
  const ref = sourceItem?.system?.ref || entry.ref || entry.inlineItem?.system?.ref;
  if (ref) tags.push({ label: "REF", value: ref });
  if (entry.kind === "attribute") {
    const selected = new Set(Array.isArray(entry.selectedAttributes) ? entry.selectedAttributes : []);
    for (const [name, value] of Object.entries(entry.attributes || {})) {
      if (Number(value) || selected.has(name)) tags.push({ label: name.toUpperCase(), value: Number(value) });
    }
  } else if (entry.cost !== undefined) tags.push({ label: game.i18n.localize("GUM.Template.Cost"), value: entry.cost });
  return GumPreviewDialog.show({
    title,
    type: entry.kind === "group" ? game.i18n.localize("GUM.Template.Package")
      : entry.kind === "template" ? game.i18n.localize("GUM.Template.Model")
        : game.i18n.localize("GUM.Template.Attribute"),
    img: entry.img || sourceItem?.img || "icons/svg/book.svg",
    description,
    tags,
    actor,
    sendToChat: false
  });
}
