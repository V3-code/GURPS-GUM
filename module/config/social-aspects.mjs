/** Shared schema used by actor and characteristic item sheets. */
export const SOCIAL_CATEGORIES = Object.freeze({
  status: { label: "GUM.Social.Status", icon: "fas fa-crown", actorPath: "social_status_entries", title: ["society", "status_name"], detail: ["level", "monthly_cost"], fields: [
    ["society", "GUM.Social.Fields.Society", "text"], ["status_name", "GUM.Social.Fields.Status", "text"], ["level", "GUM.Social.Fields.Level", "number"], ["monthly_cost", "GUM.Social.Fields.MonthlyCost", "text"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  organization: { label: "GUM.Social.Organization", icon: "fas fa-landmark", actorPath: "organization_entries", title: ["organization_name", "status_name"], detail: ["level", "salary"], fields: [
    ["organization_name", "GUM.Social.Fields.Organization", "text"], ["status_name", "GUM.Social.Fields.Status", "text"], ["level", "GUM.Social.Fields.Level", "number"], ["salary", "GUM.Social.Fields.Salary", "text"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  culture: { label: "GUM.Social.Culture", icon: "fas fa-globe-americas", actorPath: "culture_entries", title: ["culture_name"], detail: ["level"], fields: [
    ["culture_name", "GUM.Social.Fields.Culture", "text"], ["level", "GUM.Social.Fields.Level", "number"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  language: { label: "GUM.Social.Language", icon: "fas fa-language", actorPath: "language_entries", title: ["language_name"], detail: ["written_level", "spoken_level"], fields: [
    ["language_name", "GUM.Social.Fields.Language", "text"], ["written_level", "GUM.Social.Fields.Written", "text"], ["spoken_level", "GUM.Social.Fields.Spoken", "text"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  reputation: { label: "GUM.Social.Reputation", icon: "fas fa-comments", actorPath: "reputation_entries", title: ["title"], detail: ["reaction_modifier", "scope", "recognition_frequency"], fields: [
    ["title", "GUM.Social.Fields.Title", "text"], ["reaction_modifier", "GUM.Social.Fields.ReactionValue", "number"], ["scope", "GUM.Social.Fields.Audience", "text"], ["circumstance", "GUM.Social.Fields.Circumstance", "text"], ["recognition_frequency", "GUM.Social.Fields.Frequency", "text"], ["notes", "GUM.Social.Fields.Notes", "textarea"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  wealth: { label: "GUM.Social.Wealth", icon: "fas fa-coins", actorPath: "wealth_entries", title: ["wealth_level"], detail: ["effects"], fields: [
    ["wealth_level", "GUM.Social.Fields.WealthLevel", "text"], ["effects", "GUM.Social.Fields.Effects", "textarea"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  bond: { label: "GUM.Social.Bond", icon: "fas fa-link", actorPath: "bond_entries", title: ["name"], detail: ["bond_type", "description"], fields: [
    ["name", "GUM.Social.Fields.Name", "text"], ["bond_type", "GUM.Social.Fields.Type", "text"], ["description", "GUM.Social.Fields.Description", "textarea"], ["points", "GUM.Social.Fields.Points", "number"] ] },
  reaction: { label: "GUM.Social.Reaction", icon: "fas fa-theater-masks", actorPath: "reaction_modifier_entries", title: ["audience"], detail: ["value", "circumstance", "notes"], featured: true, fields: [
    ["value", "GUM.Social.Fields.ReactionValue", "number"], ["audience", "GUM.Social.Fields.Audience", "text"], ["circumstance", "GUM.Social.Fields.Circumstance", "text"], ["notes", "GUM.Social.Fields.Notes", "textarea"] ] }
});

const values = (collection) => collection ? Object.entries(collection) : [];
const text = (entry, keys) => keys.map(k => entry?.[k]).filter(v => v !== undefined && v !== "").join(" · ");

export function buildSocialSections(system = {}, items = [], localize = key => key) {
  const sections = Object.entries(SOCIAL_CATEGORIES).map(([type, config]) => {
    const entries = values(system[config.actorPath]).map(([id, entry]) => ({ id, type, entry, title: text(entry, config.title), details: text(entry, config.detail), source: "manual", sourceLabel: localize("GUM.Social.Manual") }));
    for (const item of items.filter(i => ["advantage", "disadvantage"].includes(i.type))) {
      for (const [id, contribution] of values(item.system?.social_contributions)) {
        if (contribution.type !== type) continue;
        entries.push({ id, type, entry: contribution, title: text(contribution, config.title), details: text(contribution, config.detail), source: "item", sourceLabel: item.name, sourceImg: item.img, itemId: item.id });
      }
    }
    return { type, label: localize(config.label), icon: config.icon, featured: config.featured, entries, count: entries.length };
  });
  // Reputations also participate in the reaction summary, without copying data.
  const reactions = sections.find(s => s.type === "reaction");
  for (const reputation of sections.find(s => s.type === "reputation").entries) {
    if (reputation.entry.reaction_modifier === "" || reputation.entry.reaction_modifier == null) continue;
    reactions.entries.push({ ...reputation, id: reputation.id, type: "reputation", title: reputation.entry.scope || reputation.title, details: text(reputation.entry, ["reaction_modifier", "circumstance", "recognition_frequency"]), reputationSummary: true });
  }
  reactions.count = reactions.entries.length;
  return sections;
}

export function calculateManualSocialPoints(system = {}) {
  return Object.values(SOCIAL_CATEGORIES).reduce((sum, config) => sum + values(system[config.actorPath]).reduce((n, [, entry]) => n + (Number(entry?.points) || 0), 0), 0);
}