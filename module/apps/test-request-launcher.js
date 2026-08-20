import { getGroupedRollPurposes } from "../utils/roll-purposes.mjs";
import { buildTestRequestTargets } from "../utils/test-request-targets.mjs";
import { normalizeSkillText } from "../utils/skill-default-resolver.mjs";
import { createTestRequestMessage } from "../services/test-request-service.js";

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
      title: "Solicitar Teste",
      template: "systems/gum/templates/apps/test-request-launcher.hbs",
      width: 720,
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
      "Tokens selecionados",
      "Personagens atribuídos a jogadores ativos",
      "Personagens atribuídos a jogadores offline",
      "Personagens com proprietário ativo",
      "Personagens com proprietário offline",
      "Combatentes",
      "Personagens sem jogador proprietário/NPCs"
    ];
    const groupedTargets = targetGroupOrder
      .filter(label => groups[label]?.length)
      .map(label => ({
        label,
        targets: groups[label],
        isOpen: label !== "Personagens sem jogador proprietário/NPCs" || groups[label].some(target => target.selected)
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
      skills: deduped,
      attributes: [{ key: "st", label: "ST" }, { key: "dx", label: "DX" }, { key: "iq", label: "IQ" }, { key: "ht", label: "HT" }, { key: "per", label: "PER" }, { key: "vont", label: "VONT" }]
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
    const updateTargetCount = () => html.find("[data-selected-target-count]").text(html.find("input[name=targets]:checked").length);
    html.find("input[name=targets]").on("change", updateTargetCount);
    html.find("[data-action=select-visible], [data-action=clear]").on("click", updateTargetCount);
    updateTargetCount();

    const updateTestType = () => {
      const isSkill = html.find("input[name=testType]:checked").val() === "skill";
      html.find(".attribute-fields").prop("hidden", isSkill);
      html.find(".skill-fields").prop("hidden", !isSkill);
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
  }

  async _updateObject(_event, formData) {
    const data = foundry.utils.expandObject(formData); const selected = Array.isArray(data.targets) ? data.targets : data.targets ? [data.targets] : [];
    const context = await this.getData(); const targets = context.groupedTargets.flatMap(group => group.targets).filter(target => selected.includes(target.targetKey)).map(({ selected: _selected, group: _group, ...target }) => target);
    if (!targets.length) return ui.notifications.warn("Selecione ao menos um personagem.");
    const purposes = Array.isArray(data.purposes) ? data.purposes : data.purposes ? [data.purposes] : [];
    let skill = context.skills.find(entry => entry.uuid === data.skillUuid); let type = data.testType;
    if (type === "skill" && !skill) type = "customSkill";
    await createTestRequestMessage({ title: data.title, description: data.description, targets, test: { type, attributeKey: type === "attribute" ? data.attributeKey : null, skillUuid: skill?.uuid ?? null, skillName: skill?.name ?? data.customSkillName, specialization: skill?.specialization ?? "", sourceId: skill?.sourceId ?? null, customDefault: type === "customSkill" ? { attributeKey: data.customAttributeKey, modifier: Number(data.customModifier) } : null, requestedPurposeIds: purposes, fixedModifier: Number(data.fixedModifier) || 0, fixedModifierLabel: data.fixedModifierLabel ?? "" }, delivery: { notifyPlayers: Boolean(data.notifyPlayers) } });
  }
}