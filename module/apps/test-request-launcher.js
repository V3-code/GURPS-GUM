import { getGroupedRollPurposes, normalizePurposeSearch } from "../utils/roll-purposes.mjs";
import { buildTestRequestTargets } from "../utils/test-request-targets.mjs";
import { normalizeSkillText } from "../utils/skill-default-resolver.mjs";
import { createTestRequestMessage } from "../services/test-request-service.js";

const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

let launcher;
export function openTestRequestLauncher() {
  launcher ??= new TestRequestLauncher();
  launcher.render(true);
  return launcher;
}

export class TestRequestLauncher extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gum-test-request-launcher",
      title: localize("GUM.TestRequest.Title"),
      template: "systems/gum/templates/apps/test-request-launcher.hbs",
      width: 580,
      height: 760,
      resizable: true,
      closeOnSubmit: true,
      classes: ["gum", "test-request-launcher"],
      scrollY: [".target-list", ".purpose-list"]
    });
  }

  async getData() {
    const controlled = canvas?.tokens?.controlled ?? [];
    const combatTokens = game.combat?.combatants?.map(combatant => combatant.token?.object ?? combatant.token).filter(Boolean) ?? [];
    const targets = buildTestRequestTargets({ actors: game.actors.contents, tokens: [...controlled, ...combatTokens], users: game.users.contents, selectedTokenIds: controlled.map(token => token.id) });
    const groups = targets.reduce((result, target) => {
      (result[target.group] ??= []).push(target);
      return result;
    }, {});
    const targetGroupOrder = [
      { id: "Tokens selecionados", localizationKey: "GUM.TestRequest.Groups.SelectedTokens" },
      { id: "Personagens atribuídos a jogadores ativos", localizationKey: "GUM.TestRequest.Groups.ActiveAssignedCharacters" },
      { id: "Personagens atribuídos a jogadores offline", localizationKey: "GUM.TestRequest.Groups.OfflineAssignedCharacters" },
      { id: "Personagens com proprietário ativo", localizationKey: "GUM.TestRequest.Groups.ActiveOwnerCharacters" },
      { id: "Personagens com proprietário offline", localizationKey: "GUM.TestRequest.Groups.OfflineOwnerCharacters" },
      { id: "Combatentes", localizationKey: "GUM.TestRequest.Groups.Combatants" },
      { id: "Personagens sem jogador proprietário/NPCs", localizationKey: "GUM.TestRequest.Groups.UnownedCharacters" }
    ];
    const groupedTargets = targetGroupOrder
      .filter(group => groups[group.id]?.length)
      .map(group => ({
        id: group.id,
        label: localize(group.localizationKey),
        targets: groups[group.id],
        isOpen: group.id !== "Personagens sem jogador proprietário/NPCs" || groups[group.id].some(target => target.selected)
      }));

    const pack = game.packs.get("gum.skills");
    const index = pack ? await pack.getIndex({ fields: ["system.specialization", "flags.core.sourceId"] }) : [];
    const compendiumSkills = index.map(item => ({
      name: item.name,
      specialization: item.system?.specialization ?? "",
      uuid: item.uuid ?? `Compendium.gum.skills.Item.${item._id}`,
      sourceId: item.flags?.core?.sourceId ?? null
    }));
    const actorSkills = game.actors.contents.flatMap(actor =>
      Array.from(actor.items ?? [])
        .filter(item => item.type === "skill")
        .map(item => ({
          name: item.name,
          specialization: item.system?.specialization ?? "",
          uuid: item.uuid,
          sourceId: item.getFlag?.("core", "sourceId") ?? null
        }))
    );
    const skills = [...compendiumSkills, ...actorSkills];
    const deduped = [...new Map(skills.map(skill => [
      skill.sourceId || skill.uuid || `${normalizeSkillText(skill.name)}::${normalizeSkillText(skill.specialization)}`,
      skill
    ])).values()]
      .map(skill => ({ ...skill, displayName: `${skill.name}${skill.specialization ? ` (${skill.specialization})` : ""}` }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, game.i18n?.lang || "pt-BR", { sensitivity: "base" }));

    return {
      groupedTargets,
      purposes: getGroupedRollPurposes().filter(group => group.id !== "general"),
      purposeSectionOpen: Boolean(this.purposeSectionOpen),
      skills: deduped,
      attributes: [{ key: "st", label: "ST" }, { key: "dx", label: "DX" }, { key: "iq", label: "IQ" }, { key: "ht", label: "HT" }, { key: "per", label: "Per" }, { key: "vont", label: localize("GUM.RollPrompt.WillAbbreviation") }]
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".target-search").on("input", event => {
      const query = normalizeSkillText(event.currentTarget.value);
      html.find(".target-option").each((_index, row) => {
        row.hidden = !normalizeSkillText(row.textContent).includes(query);
      });
    });
    html.find("[data-action=select-visible]").click(() => html.find(".target-option:not([hidden]) input").prop("checked", true));
    html.find("[data-action=clear]").click(() => html.find("input[name=targets]").prop("checked", false));
    const updateTargetCount = () => {
      const count = html.find("input[name=targets]:checked").length;
      html.find("[data-selected-target-summary]").text(count ? format("GUM.TestRequest.SelectedCount", { count }) : localize("GUM.TestRequest.NoneSelected"));
    };
    html.find("input[name=targets]").on("change", updateTargetCount);
    html.find("[data-action=select-visible], [data-action=clear]").on("click", updateTargetCount);
    updateTargetCount();

    const updateTestType = () => {
      const isSkill = html.find("input[name=testType]:checked").val() === "skill";
      html.find("select[name=attributeKey]").prop("disabled", isSkill);
      html.find(".skill-field-content input, .skill-field-content select").not("input[type=hidden]").prop("disabled", !isSkill);
      html.find(".attribute-fields").toggleClass("is-disabled", isSkill);
      html.find(".skill-fields").toggleClass("is-disabled", !isSkill);
    };
    html.find("input[name=testType]").on("change", updateTestType);
    updateTestType();

    const skillSearch = html.find("input[name=skillSearch]");
    const skillUuid = html.find("input[name=skillUuid]");
    skillSearch.on("input change", event => {
      const value = normalizeSkillText(event.currentTarget.value);
      const option = html.find("#gum-test-request-skills option").filter((_index, entry) => normalizeSkillText(entry.value) === value).get(0);
      skillUuid.val(option?.dataset.uuid ?? "");
      html.find(".custom-skill-fields").prop("hidden", Boolean(option));
      html.find(".unregistered-skill-notice").prop("hidden", !event.currentTarget.value.trim() || Boolean(option));
html.find("input[name=customSkillName]").val(option ? "" : event.currentTarget.value.trim());
    });

    const purposeSearch = html.find(".purpose-search-input");
    const purposeSection = html.find(".request-purpose-section").get(0);
    purposeSection?.addEventListener("toggle", () => { this.purposeSectionOpen = purposeSection.open; });
    const updatePurposeSelection = () => {
      const selected = html.find("input[name=purposes]:checked");
      const labels = selected.map((_index, input) => $(input).siblings("span").text().trim()).get();
      html.find(".purpose-selection-summary").text(labels.length ? labels.join(", ") : localize("GUM.TestRequest.NoneSelected"));
      selected.each((_index, input) => { input.closest(".purpose-group").open = true; });
    };
    const applyPurposeSearch = () => {
      const query = normalizePurposeSearch(purposeSearch.val());
      let resultCount = 0;
      html.find(".purpose-group").each((_index, groupElement) => {
        const group = $(groupElement);
        const groupMatches = normalizePurposeSearch(group.data("group-label")).includes(query);
        let groupHasResults = false;
        group.find(".purpose-option").each((__index, optionElement) => {
          const visible = !query || groupMatches || normalizePurposeSearch(optionElement.textContent).includes(query);
          optionElement.hidden = !visible;
          if (visible) { groupHasResults = true; resultCount += 1; }
        });
        groupElement.hidden = !groupHasResults;
        if (query && groupHasResults) groupElement.open = true;
        else if (!query) groupElement.open = Boolean(group.find("input[name=purposes]:checked").length);
      });
      html.find(".purpose-search-clear").toggleClass("visible", Boolean(query)).prop("disabled", !query);
      html.find(".purpose-search-empty").prop("hidden", !query || resultCount > 0);
    };
    purposeSearch.on("input", applyPurposeSearch).on("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault(); purposeSearch.val(""); applyPurposeSearch();
    });
    html.find(".purpose-search-clear").on("click", () => { purposeSearch.val("").trigger("input").trigger("focus"); });
    html.find("input[name=purposes]").on("change", updatePurposeSelection);
    updatePurposeSelection();
    html.find(".target-option, .purpose-option").on("keydown", event => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault(); $(event.currentTarget).find("input[type=checkbox]").trigger("click");
    });
  }

  async _updateObject(_event, formData) {
    const data = foundry.utils.expandObject(formData); const selected = Array.isArray(data.targets) ? data.targets : data.targets ? [data.targets] : [];
    const context = await this.getData(); const targets = context.groupedTargets.flatMap(group => group.targets).filter(target => selected.includes(target.targetKey)).map(({ selected: _selected, group: _group, ...target }) => target);
    if (!targets.length) return ui.notifications.warn(localize("GUM.TestRequest.SelectAtLeastOneCharacter"));
    const purposes = Array.isArray(data.purposes) ? data.purposes : data.purposes ? [data.purposes] : [];
    let skill = context.skills.find(entry => entry.uuid === data.skillUuid); let type = data.testType;
    if (type === "skill" && !skill) type = "customSkill";
    await createTestRequestMessage({ title: data.title, description: data.description, targets, test: { type, attributeKey: type === "attribute" ? data.attributeKey : null, skillUuid: skill?.uuid ?? null, skillName: skill?.name ?? data.customSkillName, specialization: skill?.specialization ?? "", sourceId: skill?.sourceId ?? null, customDefault: type === "customSkill" ? { attributeKey: data.customAttributeKey, modifier: Number(data.customModifier) } : null, requestedPurposeIds: purposes, fixedModifier: Number(data.fixedModifier) || 0, fixedModifierLabel: data.fixedModifierLabel ?? "" }, delivery: { notifyPlayers: Boolean(data.notifyPlayers) } });
  }
}