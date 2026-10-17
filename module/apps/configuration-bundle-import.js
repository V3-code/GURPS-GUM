import { prepareConfigurationBundle } from "../utils/configuration-bundle-json.mjs";
import { createWorldItemCompendium, synchronizeItemBundle } from "./importers.js";

const clone = value => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function escapeHtml(value) {
  return globalThis.foundry?.utils?.escapeHTML
    ? globalThis.foundry.utils.escapeHTML(String(value ?? ""))
    : String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
}

async function chooseDestinationPack(bundle) {
  const t = key => game.i18n.localize(`GUM.ConfigurationBundle.${key}`);
  const packs = game.packs.filter(pack => pack.metadata?.type === "Item");
  const canCreate = Boolean(game.user?.isGM);
  if (!packs.length && !canCreate) throw new Error(t("NoDestination"));
  const defaultLabel = `${bundle.name || bundle.id} — ${t("Dependencies")}`;

  const choice = await new Promise(resolve => new Dialog({
    title: t("DestinationTitle"),
    content: `<form class="gum-configuration-bundle-destination">
      <p class="hint">${t("DestinationHint")}</p>
      ${packs.length ? `<label><input type="radio" name="destination-mode" value="existing" ${canCreate ? "" : "checked"}> ${t("UseExisting")}</label>` : ""}
      ${canCreate ? `<label><input type="radio" name="destination-mode" value="new" checked> ${t("CreateNew")}</label>` : ""}
      ${packs.length ? `<div class="form-group"><label>${t("Compendium")}</label><select name="compendium-target">${packs.map(pack => `<option value="${escapeHtml(pack.collection)}">${escapeHtml(pack.title)}</option>`).join("")}</select></div>` : ""}
      ${canCreate ? `<div class="form-group"><label>${t("NewCompendiumName")}</label><input type="text" name="new-compendium-name" value="${escapeHtml(defaultLabel)}"></div>` : ""}
    </form>`,
    buttons: {
      import: {
        icon: '<i class="fas fa-file-import"></i>',
        label: t("Continue"),
        callback: html => resolve({
          mode: html.find('[name="destination-mode"]:checked').val(),
          collection: html.find('[name="compendium-target"]').val(),
          label: String(html.find('[name="new-compendium-name"]').val() || "").trim()
        })
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: t("Cancel"), callback: () => resolve(null) }
    },
    default: "import",
    close: () => resolve(null)
  }).render(true));

  if (!choice) return null;
  if (choice.mode === "existing") return game.packs.get(choice.collection) || null;
  if (!choice.label) throw new Error(t("NameRequired"));
  return createWorldItemCompendium(choice.label);
}

/** Import embedded Items first, then replace the owning setting as one transaction. */
export async function importConfigurationBundle(bundle, {
  expectedKind,
  getCurrentConfiguration,
  applyConfiguration
}) {
  const t = key => game.i18n.localize(`GUM.ConfigurationBundle.${key}`);
  if (bundle.kind !== expectedKind) throw new Error(t("WrongKind"));
  const previousConfiguration = clone(await getCurrentConfiguration());
  const hasDocuments = Object.keys(bundle.documents || {}).length > 0;
  let configurationApplied = false;

  if (!hasDocuments) {
    const prepared = prepareConfigurationBundle(bundle);
    await applyConfiguration(prepared.configuration);
    ui.notifications.info(t("ImportSuccess"));
    return { configuration: prepared.configuration, pack: null, documents: [] };
  }

  // Validate every local reference before a new compendium can be created.
  prepareConfigurationBundle(bundle, "world.configuration-preview");
  const pack = await chooseDestinationPack(bundle);
  if (!pack) return null;
  const prepared = prepareConfigurationBundle(bundle, pack.collection);
  const result = await synchronizeItemBundle(pack, prepared.itemBundle, {
    notifySuccess: false,
    afterSynchronize: async () => {
      await applyConfiguration(prepared.configuration);
      configurationApplied = true;
    }
  });

  if (!result) {
    if (configurationApplied) {
      try {
        await applyConfiguration(previousConfiguration);
      } catch (error) {
        console.error("GUM | Unable to restore configuration after bundle rollback:", error);
        ui.notifications.error(t("ConfigurationRollbackFailed"));
      }
    }
    return null;
  }

  ui.notifications.info(t("ImportSuccess"));
  return { ...result, configuration: prepared.configuration, pack };
}
