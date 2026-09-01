/** Shared schema used by actor and characteristic item sheets. */
export const SOCIAL_CATEGORIES = Object.freeze({
  status: { label: "GUM.Social.Status", icon: "fas fa-crown", actorPath: "social_status_entries", title: ["society"], detail: ["level", "status_name", "monthly_cost"], fields: [
    ["society", "GUM.Social.Fields.Society", "text", { row: 1, wide: true }], ["level", "GUM.Social.Fields.Level", "number", { row: 2, compact: true }], ["status_name", "GUM.Social.Fields.Status", "text", { row: 2 }], ["monthly_cost", "GUM.Social.Fields.MonthlyCost", "text", { row: 2 }], ["description", "GUM.Social.Fields.SocietyDescription", "textarea", { row: 3, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  organization: { label: "GUM.Social.Organization", icon: "fas fa-landmark", actorPath: "organization_entries", title: ["organization_name"], detail: ["level", "status_name", "salary"], fields: [
    ["organization_name", "GUM.Social.Fields.Organization", "text", { row: 1, wide: true }], ["level", "GUM.Social.Fields.Level", "number", { row: 2, compact: true }], ["status_name", "GUM.Social.Fields.Status", "text", { row: 2 }], ["salary", "GUM.Social.Fields.Salary", "text", { row: 2 }], ["description", "GUM.Social.Fields.OrganizationDescription", "textarea", { row: 3, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  culture: { label: "GUM.Social.Culture", icon: "fas fa-globe-americas", actorPath: "culture_entries", title: ["culture_name"], detail: ["level"], fields: [
    ["level", "GUM.Social.Fields.Level", "number", { row: 1, compact: true }], ["culture_name", "GUM.Social.Fields.Culture", "text", { row: 1 }], ["description", "GUM.Social.Fields.CultureDescription", "textarea", { row: 2, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  language: { label: "GUM.Social.Language", icon: "fas fa-language", actorPath: "language_entries", title: ["language_name"], detail: ["written_level", "spoken_level"], fields: [
    ["language_name", "GUM.Social.Fields.Language", "text", { row: 1, wide: true }], ["spoken_level", "GUM.Social.Fields.SpokenLevel", "text", { row: 2 }], ["written_level", "GUM.Social.Fields.WrittenLevel", "text", { row: 2 }], ["description", "GUM.Social.Fields.LanguageDescription", "textarea", { row: 3, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  reputation: { label: "GUM.Social.Reputation", icon: "fas fa-comments", actorPath: "reputation_entries", title: ["title"], detail: ["reaction_modifier", "scope", "recognition_frequency"], fields: [
    ["reaction_modifier", "GUM.Social.Fields.ReactionValue", "number", { row: 1, compact: true }], ["title", "GUM.Social.Fields.ReputationTitle", "text", { row: 1 }], ["scope", "GUM.Social.Fields.Audience", "text", { row: 2 }], ["circumstance", "GUM.Social.Fields.Circumstance", "text", { row: 2 }], ["recognition_frequency", "GUM.Social.Fields.Frequency", "text", { row: 2 }], ["notes", "GUM.Social.Fields.ReputationDescription", "textarea", { row: 3, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  wealth: { label: "GUM.Social.Wealth", icon: "fas fa-coins", actorPath: "wealth_entries", title: ["wealth_level"], detail: ["effects"], fields: [
    ["wealth_level", "GUM.Social.Fields.WealthLevel", "text", { row: 1, wide: true }], ["effects", "GUM.Social.Fields.WealthDescription", "textarea", { row: 2, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  bond: { label: "GUM.Social.Bond", icon: "fas fa-link", actorPath: "bond_entries", title: ["name"], detail: ["bond_type", "description"], fields: [
    ["name", "GUM.Social.Fields.Name", "text", { row: 1 }], ["bond_type", "GUM.Social.Fields.BondType", "text", { row: 1 }], ["description", "GUM.Social.Fields.BondDescription", "textarea", { row: 2, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] },
  reaction: { label: "GUM.Social.Reaction", icon: "fas fa-theater-masks", actorPath: "reaction_modifier_entries", title: ["title", "audience"], detail: ["value", "circumstance", "notes"], featured: true, fields: [
    ["value", "GUM.Social.Fields.ReactionValue", "number", { row: 1, compact: true }], ["title", "GUM.Social.Fields.ReputationTitle", "text", { row: 1 }], ["audience", "GUM.Social.Fields.Audience", "text", { row: 2 }], ["circumstance", "GUM.Social.Fields.Circumstance", "text", { row: 2 }], ["recognition_frequency", "GUM.Social.Fields.Frequency", "text", { row: 2 }], ["notes", "GUM.Social.Fields.ReactionDescription", "textarea", { row: 3, wide: true }], ["points", "GUM.Social.Fields.Points", "number"] ] }
});

const values = (collection) => collection ? Object.entries(collection) : [];

const SOCIAL_PRESENTATION = Object.freeze({
  status: {
    primary: ["society", "status_name"], context: [], observation: ["description"],
    metrics: [["level", "GUM.Social.Fields.Level"], ["status_name", "GUM.Social.Fields.Status"], ["monthly_cost", "GUM.Social.Fields.MonthlyCost"]]
  },
  organization: {
    primary: ["organization_name", "status_name"], context: [], observation: ["description"],
    metrics: [["level", "GUM.Social.Fields.Level"], ["status_name", "GUM.Social.Fields.Status"], ["salary", "GUM.Social.Fields.Salary"]]
  },
  culture: {
    primary: ["culture_name"], context: [], observation: ["description"],
    metrics: [["level", "GUM.Social.Fields.Level"]]
  },
  language: {
    primary: ["language_name"], context: [], observation: ["description"],
    metrics: [["spoken_level", "GUM.Social.Fields.SpokenLevel"], ["written_level", "GUM.Social.Fields.WrittenLevel"]]
  },
  reputation: {
    primary: ["title"], context: ["scope"], observation: ["notes"],
    metrics: [["reaction_modifier", "GUM.Social.Fields.ReactionValue", { signed: true }], ["recognition_frequency", "GUM.Social.Fields.Frequency"], ["circumstance", "GUM.Social.Fields.Circumstance"]]
  },
  wealth: {
    primary: ["wealth_level"], context: [], observation: ["effects"], metrics: []
  },
  bond: {
    primary: ["name"], context: [], observation: ["description"],
    metrics: [["bond_type", "GUM.Social.Fields.BondType"]]
  },
  reaction: {
    primary: ["title", "audience"], context: ["audience"], observation: ["notes"],
    metrics: [["value", "GUM.Social.Fields.ReactionValue", { signed: true }], ["recognition_frequency", "GUM.Social.Fields.Frequency"], ["circumstance", "GUM.Social.Fields.Circumstance"]]
  }
});

const hasValue = value => value !== undefined && value !== null && value !== "";
const firstValue = (entry, keys = []) => keys.map(key => entry?.[key]).find(hasValue);
const signedValue = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number > 0 ? `+${number}` : `${number}`;
};

function decorateSocialEntry(type, id, entry, sourceData, localize) {
  const category = SOCIAL_CATEGORIES[type];
  const presentation = SOCIAL_PRESENTATION[type] || {};
  const primaryValue = firstValue(entry, presentation.primary) ?? localize(category?.label || "GUM.Social.Tab");
  const contextValues = (presentation.context || [])
    .map(key => entry?.[key])
    .filter(value => hasValue(value) && value !== primaryValue);
  const metrics = (presentation.metrics || []).flatMap(([key, label, options = {}]) => {
    const rawValue = entry?.[key];
    if (!hasValue(rawValue)) return [];
    const numericValue = Number(rawValue);
    const tone = options.signed && Number.isFinite(numericValue)
      ? (numericValue > 0 ? "positive" : numericValue < 0 ? "negative" : "neutral")
      : "default";
    return [{ key, label: localize(label), value: options.signed ? signedValue(rawValue) : rawValue, tone }];
  });
  const observation = firstValue(entry, presentation.observation);

  return {
    id,
    type,
    entry,
    primary: `${primaryValue}`,
    context: contextValues.join(" · "),
    metrics,
    observation: hasValue(observation) ? `${observation}` : "",
    displayIcon: category?.icon || "fas fa-users",
    title: `${primaryValue}`,
    details: metrics.map(metric => metric.value).join(" · "),
    ...sourceData
  };
}

export function buildSocialSections(system = {}, items = [], localize = key => key) {
  const sections = Object.entries(SOCIAL_CATEGORIES).map(([type, config]) => {
    const entries = values(system[config.actorPath]).map(([id, entry]) => decorateSocialEntry(type, id, entry, {
      source: "manual", sourceLabel: localize("GUM.Social.Manual")
    }, localize));
    for (const item of items.filter(i => ["advantage", "disadvantage"].includes(i.type))) {
      for (const [id, contribution] of values(item.system?.social_contributions)) {
        if (contribution.type !== type) continue;
        entries.push(decorateSocialEntry(type, id, contribution, {
          source: "item", sourceLabel: item.name, sourceImg: item.img, itemId: item.id
        }, localize));
      }
    }
    return { type, label: localize(config.label), icon: config.icon, featured: config.featured, entries, count: entries.length };
  });
  // Reputations and direct reaction modifiers share one presentation group.
  const reactions = sections.find(s => s.type === "reaction");
  for (const reputation of sections.find(s => s.type === "reputation").entries) {
    reactions.entries.push({ ...reputation, id: reputation.id, type: "reputation", reputationSummary: true });
  }
  reactions.count = reactions.entries.length;
  return sections.filter(section => section.type !== "reputation");
}

export function calculateManualSocialPoints(system = {}) {
  return Object.values(SOCIAL_CATEGORIES).reduce((sum, config) => sum + values(system[config.actorPath]).reduce((n, [, entry]) => n + (Number(entry?.points) || 0), 0), 0);
}
