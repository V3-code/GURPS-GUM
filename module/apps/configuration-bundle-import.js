import {
  combineConfigurationImport,
  prepareConfigurationBundle,
  previewConfigurationImport
} from "../utils/configuration-bundle-json.mjs";
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
    content: `<form class="gum-compendium-import-form gum-configuration-bundle-destination">
      <div class="gum-import-file-summary">
        <i class="fas fa-puzzle-piece"></i>
        <span><strong>${escapeHtml(bundle.name || bundle.id)}</strong><small>${t("Dependencies")}</small></span>
      </div>
      <p class="hint">${t("DestinationHint")}</p>
      <div class="gum-import-mode-picker">
        ${packs.length ? `<label><input type="radio" name="destination-mode" value="existing" ${canCreate ? "" : "checked"}>
          <span><i class="fas fa-book"></i> ${t("UseExisting")}</span></label>` : ""}
        ${canCreate ? `<label><input type="radio" name="destination-mode" value="new" checked>
          <span><i class="fas fa-folder-plus"></i> ${t("CreateNew")}</span></label>` : ""}
      </div>
      ${packs.length ? `<div class="form-group" data-destination="existing" ${canCreate ? 'style="display:none"' : ""}><label>${t("Compendium")}</label><select name="compendium-target">${packs.map(pack => `<option value="${escapeHtml(pack.collection)}">${escapeHtml(pack.title)}</option>`).join("")}</select></div>` : ""}
      ${canCreate ? `<div class="form-group" data-destination="new"><label>${t("NewCompendiumName")}</label><input type="text" name="new-compendium-name" value="${escapeHtml(defaultLabel)}"></div>` : ""}
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
    render: html => {
      html.find('[name="destination-mode"]').on("change", event => {
        const mode = event.currentTarget.value;
        html.find("[data-destination]").hide();
        html.find(`[data-destination="${mode}"]`).show();
      });
    },
    close: () => resolve(null)
  }, {
    classes: ["dialog", "gum", "gum-compendium-import-dialog", "gum-configuration-bundle-dialog"],
    width: 560
  }).render(true));

  if (!choice) return null;
  if (choice.mode === "existing") return game.packs.get(choice.collection) || null;
  if (!choice.label) throw new Error(t("NameRequired"));
  return createWorldItemCompendium(choice.label);
}

export async function chooseConfigurationImportMode(kind, currentConfiguration, incomingConfiguration, {
  portability = null
} = {}) {
  const t = key => game.i18n.localize(`GUM.ConfigurationBundle.${key}`);
  const summary = previewConfigurationImport(kind, currentConfiguration, incomingConfiguration);
  const portabilityReferences = (portability?.unresolvedReferences?.length || 0)
    + (portability?.unsupportedReferences?.length || 0);
  const portabilityAssets = portability?.externalAssets?.length || 0;
  const portabilityWarning = portability && portability.complete !== true
    ? `<p class="gum-import-sync-warning"><i class="fas fa-link-slash"></i> ${game.i18n.format(
      "GUM.ConfigurationBundle.ImportPortabilityWarning",
      { references: portabilityReferences, assets: portabilityAssets }
    )}</p>`
    : "";
  return new Promise(resolve => new Dialog({
    title: t("ImportModeTitle"),
    content: `<form class="gum-compendium-import-form gum-configuration-import-mode">
      <p class="hint">${t("ImportModeHint")}</p>
      ${portabilityWarning}
      <div class="gum-import-sync-preview">
        <strong>${t("PreviewTitle")}</strong>
        <dl>
          <div><dt>${t("PreviewCreates")}</dt><dd>${summary.creates}</dd></div>
          <div><dt>${t("PreviewUpdates")}</dt><dd>${summary.updates}</dd></div>
          <div><dt>${t("PreviewUnchanged")}</dt><dd>${summary.unchanged}</dd></div>
          <div><dt>${t("PreviewRemoves")}</dt><dd>${summary.removes}</dd></div>
        </dl>
      </div>
      <div class="gum-import-mode-picker gum-configuration-mode-picker">
        <label><input type="radio" name="configuration-mode" value="add">
          <span><i class="fas fa-plus"></i> ${t("ModeAdd")}</span></label>
        <label><input type="radio" name="configuration-mode" value="merge" checked>
          <span><i class="fas fa-code-merge"></i> ${t("ModeMerge")}</span></label>
        <label><input type="radio" name="configuration-mode" value="replace">
          <span><i class="fas fa-arrows-rotate"></i> ${t("ModeReplace")}</span></label>
      </div>
      <p class="hint" data-mode-description>${t("ModeMergeHint")}</p>
      <p class="gum-import-sync-warning" data-replace-warning style="display:none">
        <i class="fas fa-triangle-exclamation"></i> ${t("ReplaceWarning")}
      </p>
    </form>`,
    buttons: {
      import: {
        icon: '<i class="fas fa-file-import"></i>',
        label: t("Continue"),
        callback: html => resolve(html.find('[name="configuration-mode"]:checked').val() || "merge")
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: t("Cancel"), callback: () => resolve(null) }
    },
    default: "import",
    render: html => {
      const updateDescription = mode => {
        const suffix = mode === "add" ? "ModeAddHint" : mode === "replace" ? "ModeReplaceHint" : "ModeMergeHint";
        html.find("[data-mode-description]").text(t(suffix));
        html.find("[data-replace-warning]").toggle(mode === "replace" && summary.removes > 0);
      };
      html.find('[name="configuration-mode"]').on("change", event => updateDescription(event.currentTarget.value));
      updateDescription("merge");
    },
    close: () => resolve(null)
  }, {
    classes: ["dialog", "gum", "gum-compendium-import-dialog", "gum-configuration-mode-dialog"],
    width: 620
  }).render(true));
}

/** Import embedded Items first, then apply the selected configuration mode as one transaction. */
export async function importConfigurationBundle(bundle, {
  expectedKind,
  getCurrentConfiguration,
  applyConfiguration,
  importMode = null,
  normalizeConfiguration = configuration => configuration
}) {
  const t = key => game.i18n.localize(`GUM.ConfigurationBundle.${key}`);
  if (bundle.kind !== expectedKind) throw new Error(t("WrongKind"));
  const previousConfiguration = clone(normalizeConfiguration(await getCurrentConfiguration()));
  const hasDocuments = Object.keys(bundle.documents || {}).length > 0;
  // Resolve local references against a harmless preview collection before showing any choices.
  const previewPrepared = prepareConfigurationBundle(
    bundle,
    hasDocuments ? "world.configuration-preview" : ""
  );
  const previewConfiguration = normalizeConfiguration(previewPrepared.configuration);
  const mode = importMode || await chooseConfigurationImportMode(
    bundle.kind,
    previousConfiguration,
    previewConfiguration,
    { portability: bundle.portability }
  );
  if (!mode) return null;
  let configurationApplied = false;

  if (!hasDocuments) {
    const configuration = combineConfigurationImport(
      bundle.kind,
      previousConfiguration,
      previewConfiguration,
      mode
    );
    await applyConfiguration(configuration);
    ui.notifications.info(t("ImportSuccess"));
    return { configuration, mode, pack: null, documents: [] };
  }

  const pack = await chooseDestinationPack(bundle);
  if (!pack) return null;
  const prepared = prepareConfigurationBundle(bundle, pack.collection);
  const normalizedPreparedConfiguration = normalizeConfiguration(prepared.configuration);
  const configuration = combineConfigurationImport(
    bundle.kind,
    previousConfiguration,
    normalizedPreparedConfiguration,
    mode
  );
  const result = await synchronizeItemBundle(pack, prepared.itemBundle, {
    notifySuccess: false,
    afterSynchronize: async () => {
      await applyConfiguration(configuration);
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
  return { ...result, configuration, mode, pack };
}
