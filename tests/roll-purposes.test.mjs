import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROLL_PURPOSES, getGroupedRollPurposes, getPurposeLabels, matchesRollTags, normalizePurposeIds, normalizePurposeSearch, registerRollPurpose, resolveRollMetadata, searchRollPurposes, shouldIncludeInPermanentNh } from "../module/utils/roll-purposes.mjs";

const makeI18n = language => {
  const catalog = JSON.parse(readFileSync(new URL(`../lang/${language}.json`, import.meta.url), "utf8"));
  const get = key => key.split(".").reduce((value, part) => value?.[part], catalog);
  return { lang: language, localize: key => get(key) ?? key, format: (key, data = {}) => String(get(key) ?? key).replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? `{${name}}`) };
};
const ptI18n = makeI18n("pt-BR");
const enI18n = makeI18n("en");
globalThis.game = { i18n: ptI18n };

test("busca finalidades por texto, metadados e sem diferenciar acentos ou caixa", () => {
  assert.equal(normalizePurposeSearch("  NÁUSEA "), "nausea");
  assert.deepEqual(searchRollPurposes("NÁUSEA").map(p => p.id), ["resist_nausea"]);
  assert.ok(searchRollPurposes("resist_poison").some(p => p.id === "resist_poison"));
  assert.ok(searchRollPurposes("resistance.poison").some(p => p.id === "resist_poison"));
  assert.ok(searchRollPurposes("consequencias fisicas").some(p => p.id === "resist_magic"));
});

test("catálogo localizado busca em inglês e preserva a busca legada em português", () => {
  assert.deepEqual(getPurposeLabels(["resist_poison"], { i18n: enI18n }), ["Resist Poison"]);
  assert.ok(searchRollPurposes("resist poison", { i18n: enI18n }).some(purpose => purpose.id === "resist_poison"));
  assert.ok(searchRollPurposes("veneno", { i18n: enI18n }).some(purpose => purpose.id === "resist_poison"));
  const groups = getGroupedRollPurposes("ht", ["resist_poison"], "poison", { i18n: enI18n });
  assert.equal(groups.find(group => group.id === "resistances").label, "Physical Resistances");
  assert.equal(groups.find(group => group.id === "resistances").purposes[0].id, "resist_poison");
});

test("keywords localizam a finalidade sem se tornarem tags", () => {
  const original={...ROLL_PURPOSES.find(p => p.id === "resist_poison")};
  const purpose=registerRollPurpose({...original,keywords:["apelido secreto"]});
  assert.ok(searchRollPurposes("APELIDO").some(p => p.id === purpose.id));
  assert.deepEqual(resolveRollMetadata({purposeIds:[purpose.id]}).rollTags, ["resistance.poison", "resistance.metabolic", "resistance.physical", "test.resistance"]);
  assert.deepEqual(getGroupedRollPurposes(null, [], "secreto").find(group => group.id === "resistances").purposes.map(p => p.id), [purpose.id]);
  registerRollPurpose(original);
});
import { ROLL_TAG_ALIASES, ROLL_TAG_CATALOG, expandRollTags, getGroupedRollTags, normalizeRollTags } from "../module/utils/roll-tags.mjs";
import { buildPurposeQuickView, buildPurposeQuickViewContent, calculatePurposePreviewHeight, getRollPurposeById, PurposeQuickView } from "../module/apps/purpose-quick-view.mjs";

const requiredPurposes = `general knockdown_stun recover_physical_stun consciousness regain_consciousness death resist_bleeding natural_recovery crippling_recovery pain resist_torture resist_metabolic_hazard resist_poison resist_disease resist_infection resist_paralysis resist_incapacitation resist_unconsciousness resist_nausea resist_seizure resist_addiction resist_alcohol fright_check resist_fear resist_intimidation avoid_mental_stun recover_mental_stun self_control resist_mental_influence resist_possession maintain_concentration resist_confusion memorize recall_information prolonged_mental_task creativity maintain_balance avoid_fall controlled_fall resist_takedown resist_knockback_fall stay_mounted break_free resist_suffocation resist_exertion resist_heat resist_cold resist_altitude resist_pressure resist_vacuum resist_radiation resist_acceleration resist_sleep_deprivation sleep_rest aging_check sense_general sense_vision sense_hearing sense_taste_smell sense_smell sense_taste sense_touch sense_detection resist_magic resist_psionic resist_supernatural_power resist_power resist_telepathy sensory_vector_vision sensory_vector_hearing sensory_vector_smell sensory_vector_taste sensory_vector_touch sensory_vector_smell_taste inhaled_agent reaction_roll influence_roll resist_deception resist_interrogation be_heard appear_honest fashion_context healthy_appearance unnecessary_risk`.split(" ");

test("catálogo contém todas as finalidades obrigatórias e preserva os 16 IDs antigos", () => {
  const ids = new Set(ROLL_PURPOSES.map(p => p.id));
  requiredPurposes.forEach(id => assert.ok(ids.has(id), id));
  `general knockdown_stun consciousness death pain resist_poison resist_disease resist_paralysis resist_incapacitation fright_check resist_fear resist_intimidation sense_vision sense_hearing sense_taste_smell sense_touch`.split(" ").forEach(id => assert.ok(ids.has(id)));
  assert.equal(getGroupedRollPurposes().flatMap(g => g.purposes).length, requiredPurposes.length);
});

test("normalização resolve aliases, personalizadas, ordem, deduplicação e idempotência", () => {
  const expected = ["resistance.poison", "minha_tag"];
  assert.deepEqual(normalizeRollTags(" Poison, minha_tag, poison "), expected);
  assert.deepEqual(normalizeRollTags(normalizeRollTags(expected)), expected);
  Object.entries(ROLL_TAG_ALIASES).forEach(([old, canonical]) => assert.deepEqual(normalizeRollTags(old), [canonical]));
});

test("veneno expande hierarquia em ordem estável sem duplicatas", () => {
  const tags = expandRollTags(["resistance.poison", "resistance.poison"]);
  assert.deepEqual(tags, ["resistance.poison", "resistance.metabolic", "resistance.physical", "test.resistance"]);
  assert.equal(new Set(tags).size, tags.length);
});

test("any/all usam igualdade canônica e tags ancestrais", () => {
  const poison = resolveRollMetadata({ purposeIds:["resist_poison"] }).rollTags;
  assert.equal(matchesRollTags({roll_tags:"poison, resistance.magic",roll_tag_match:"any"}, poison), true);
  assert.equal(matchesRollTags({roll_tags:"resistance.metabolic"}, poison), true);
  assert.equal(matchesRollTags({roll_tags:"resistance.poison, resistance.magic",roll_tag_match:"all"}, poison), false);
  const magicPoison = resolveRollMetadata({purposeIds:["resist_poison","resist_magic"]}).rollTags;
  assert.equal(matchesRollTags({roll_tags:"resistance.poison, resistance.magic",roll_tag_match:"all"}, magicPoison), true);
  assert.equal(matchesRollTags({roll_tags:"resistance.poison"}, resolveRollMetadata({purposeIds:["resist_disease"]}).rollTags), false);
});

test("Teste Geral é neutro; sem filtro preserva legado", () => {
  assert.deepEqual(normalizePurposeIds(["general","unknown"]), []);
  assert.deepEqual(resolveRollMetadata({purposeIds:[]}).rollTags, []);
  assert.equal(matchesRollTags({contexts:"check"}, []), true);
  assert.equal(matchesRollTags({roll_tags:"poison"}, []), false);
});

test("nocaute e atordoamento formam um teste conjunto, separado das recuperações", () => {
  const initial = resolveRollMetadata({purposeIds:["knockdown_stun"]}).rollTags;
  for (const tag of ["injury.knockdown","injury.stun.physical","injury.knockdown_stun","test.survival"]) assert.ok(initial.includes(tag));
  for (const tag of ["injury.knockdown_stun","injury.knockdown","injury.stun.physical"]) assert.equal(matchesRollTags({roll_tags:tag},initial),true);
  for (const tag of ["recovery.stun.physical","injury.stay_conscious","recovery.consciousness","resistance.unconsciousness"]) assert.equal(matchesRollTags({roll_tags:tag},initial),false);
  const recovery=resolveRollMetadata({purposeIds:["recover_physical_stun"]}).rollTags;
  assert.equal(matchesRollTags({roll_tags:"injury.stun.physical"},recovery),false);
  assert.equal(matchesRollTags({roll_tags:"knockdown, stun, injury",roll_tag_match:"all"},initial),true);
}); 

test("sentido e vetor sensorial são conceitos separados", () => {
  const vision=resolveRollMetadata({purposeIds:["sense_vision"]}).rollTags;
  assert.equal(matchesRollTags({roll_tags:"vector.sensory.vision"},vision),false);
  assert.ok(ROLL_TAG_CATALOG.some(t=>t.id==="vector.sensory.vision"));
});

test("metadados, serialização e atributo preservam finalidades combináveis", () => {
  const ids=["resist_poison","resist_magic"];
  const restored=JSON.parse(JSON.stringify({purposeIds:ids}));
  assert.deepEqual(resolveRollMetadata({...restored,attributeKey:"ht"}).purposeIds,ids);
  assert.deepEqual(resolveRollMetadata({...restored,attributeKey:"vont"}).purposeIds,ids);
  assert.equal(ROLL_PURPOSES.find(p=>p.id==="resist_magic").role,"qualifier");
});

test("todas as tags dos perfis existem no catálogo e picker preserva personalizadas", () => {
  const known=new Set(ROLL_TAG_CATALOG.map(t=>t.id));
  ROLL_PURPOSES.flatMap(p=>p.tags).forEach(tag=>assert.ok(known.has(tag),tag));
  assert.deepEqual(getGroupedRollTags("resistance.poison, minha_tag").flatMap(g=>g.tags).find(t=>t.id==="resistance.poison").selected,true);
  assert.deepEqual(normalizeRollTags("resistance.poison, minha_tag"),["resistance.poison","minha_tag"]);
});

test("modificador por finalidade não entra no NH permanente", () => {
  assert.equal(shouldIncludeInPermanentNh({nh_display_mode:"include_in_nh",roll_tags:"poison"}),false);
  assert.equal(shouldIncludeInPermanentNh({nh_display_mode:"include_in_nh"}),true);
  assert.deepEqual(getPurposeLabels(["resist_poison"]),["Resistência a Veneno"]);
});

test("view model traduz grupo, tipo, bases e preserva o catálogo", () => {
  const original = structuredClone(getRollPurposeById("fright_check"));
  const view = buildPurposeQuickView("fright_check");
  assert.equal(view.groupLabel, "Mentais e Comportamentais");
  assert.equal(view.roleLabel, "Finalidade principal");
  assert.deepEqual(view.suggestedBases, ["Vontade"]);
  assert.deepEqual(view.recommendedFilterTags, ["mental.fright_check"]);
  assert.ok(view.distinctions.length);
  assert.ok(view.references.length);
  assert.deepEqual(getRollPurposeById("fright_check"), original);
  assert.equal(getRollPurposeById("desconhecida"), null);
});

test("view model separa tags diretas e herdadas com ordem estável", () => {
  const view = buildPurposeQuickView("knockdown_stun");
  assert.deepEqual(view.directTags, ["injury.knockdown", "injury.stun.physical"]);
  assert.deepEqual(view.recommendedFilterTags, ["injury.knockdown_stun"]);
  assert.ok(view.inheritedTags.includes("injury.knockdown_stun"));
  assert.ok(view.inheritedTags.includes("test.survival"));
  assert.equal(new Set(view.inheritedTags).size, view.inheritedTags.length);
});

test("view model aplica fallbacks e omite metadados opcionais ausentes", () => {
  const catalog = [{ id: "custom", label: "Teste Personalizado", group: "other", tags: ["custom.tag", "custom.tag"] }];
  const source = structuredClone(catalog);
  const view = buildPurposeQuickView("custom", { catalog, groups: [], expandTags: tags => [...tags, "custom.parent", "custom.parent"] });
  assert.match(view.description, /Teste Personalizado/i);
  assert.deepEqual(view.distinctions, []);
  assert.deepEqual(view.references, []);
  assert.deepEqual(view.recommendedFilterTags, ["custom.tag"]);
  assert.deepEqual(view.inheritedTags, ["custom.parent"]);
  assert.deepEqual(catalog, source);
});

test("qualificador de magia e Teste Geral têm apresentação segura", () => {
  const magic = buildPurposeQuickView("resist_magic");
  assert.equal(magic.roleLabel, "Qualificador");
  assert.match(magic.qualifierHint, /combinados/);
  assert.deepEqual(magic.recommendedFilterTags, ["resistance.magic"]);
  const general = buildPurposeQuickView("general");
  assert.deepEqual(general.directTags, []);
  assert.deepEqual(general.inheritedTags, []);
  assert.deepEqual(general.recommendedFilterTags, []);
  assert.match(general.description, /Não produz tags semânticas/);
});

test("quick view reutiliza toda a cadeia de classes do preview premium", () => {
  const html = buildPurposeQuickViewContent(buildPurposeQuickView("knockdown_stun"));
  assert.match(html, /gurps-dialog-canvas gum-preview-canvas gum-purpose-preview-canvas/);
  assert.match(html, /gurps-item-preview-card gum-preview-card gum-purpose-preview-card/);
  assert.match(html, /preview-header gum-purpose-preview-header/);
  assert.match(html, /preview-content gum-purpose-preview-content/);
  assert.match(html, /class="purpose-copy-tag"/);
  assert.match(html, /<details><summary>Categorias herdadas<\/summary>/);
});

test("quick view acompanha o idioma sem alterar tags ou referências", () => {
  const view = buildPurposeQuickView("resist_magic", { i18n: enI18n });
  assert.equal(view.label, "Resist Magic");
  assert.equal(view.groupLabel, "Sources and Powers");
  assert.equal(view.roleLabel, "Qualifier");
  assert.match(view.description, /direct resistance to the source/i);
  assert.deepEqual(view.distinctions, ["Indirect physical consequences of a spell; this purpose represents direct resistance to magical influence."]);
  assert.deepEqual(view.directTags, ["resistance.magic", "source.magic"]);
  const html = buildPurposeQuickViewContent(view, { i18n: enI18n });
  assert.match(html, /Test Purpose/);
  assert.match(html, /When to Use/);
  assert.match(html, /Recommended Effect Tag/);
  assert.match(html, /Inherited Categories/);
});

test("quick view abre na altura natural, limitada a 75% da viewport", () => {
  assert.equal(calculatePurposePreviewHeight(34, 320, 1000), 356);
  assert.equal(calculatePurposePreviewHeight(34, 900, 1000), 750);
});

test("quick view remove o rodapé vazio do Dialog antes de medir o card", () => {
  let removedFooter = false;
  let positionedHeight = null;
  const root = {
    addClass() {},
    find: selector => selector === ".window-header" ? { outerHeight: () => 34 } : { outerHeight: () => 0 }
  };
  const html = {
    closest: () => root,
    find: selector => {
      if (selector === ".dialog-buttons") return { remove: () => { removedFooter = true; } };
      if (selector === ".purpose-copy-tag") return { on() {} };
      if (selector === ".gum-purpose-preview-canvas") return { 0: { scrollHeight: 280 } };
      if (selector === ".gum-purpose-preview-card") return { outerHeight: () => 320 };
      return { outerHeight: () => 0 };
    }
  };
  globalThis.window = { innerHeight: 1000 };
  globalThis.requestAnimationFrame = callback => callback();
  globalThis.Dialog = class {
    constructor(data) { this.data = data; }
    render() { this.data.render(html); }
    setPosition({ height }) { positionedHeight = height; }
  };
  try {
    PurposeQuickView.show("knockdown_stun");
    assert.equal(removedFooter, true);
    assert.equal(positionedHeight, 316);
  } finally {
    PurposeQuickView.current = null;
    delete globalThis.Dialog;
    delete globalThis.requestAnimationFrame;
    delete globalThis.window;
  }
});

test("novas tags existem e preservam hierarquias específicas e legadas", () => {
  const requiredTags = `mental.memory mental.memory.memorize mental.memory.recall mental.task.prolonged mental.creativity sense.smell sense.taste vector.sensory.smell vector.sensory.taste vector.inhaled resistance.alcohol communication.be_heard social.appear_honest social.fashion social.healthy_appearance risk.unnecessary`.split(" ");
  const known = new Set(ROLL_TAG_CATALOG.map(tag => tag.id));
  requiredTags.forEach(tag => assert.ok(known.has(tag), tag));
  assert.deepEqual(expandRollTags("sense.smell").slice(0, 2), ["sense.smell", "sense.smell_taste"]);
  assert.deepEqual(expandRollTags("sense.taste").slice(0, 2), ["sense.taste", "sense.smell_taste"]);
  assert.ok(expandRollTags("resistance.alcohol").includes("resistance.metabolic"));
});

test("olfato e paladar são distintos, mas o filtro legado alcança ambos uma única vez", () => {
  const smell = resolveRollMetadata({ purposeIds: ["sense_smell"] }).rollTags;
  const taste = resolveRollMetadata({ purposeIds: ["sense_taste"] }).rollTags;
  assert.equal(matchesRollTags({ roll_tags: "sense.smell" }, taste), false);
  assert.equal(matchesRollTags({ roll_tags: "sense.taste" }, smell), false);
  assert.equal(matchesRollTags({ roll_tags: "sense.smell_taste" }, smell), true);
  assert.equal(matchesRollTags({ roll_tags: "sense.smell_taste" }, taste), true);
  const actions = [{ roll_tags: "sense.smell,sense.taste", roll_tag_match: "any", modifier: 2 }];
  const combined = resolveRollMetadata({ purposeIds: ["sense_smell", "sense_taste"] }).rollTags;
  assert.equal(actions.filter(action => matchesRollTags(action, combined)).reduce((sum, action) => sum + action.modifier, 0), 2);
});

test("vetor visual não produz nem corresponde à tag de teste de visão", () => {
  const vector = resolveRollMetadata({ purposeIds: ["sensory_vector_vision"] }).rollTags;
  assert.ok(vector.includes("vector.sensory.vision"));
  assert.equal(vector.includes("sense.vision"), false);
  assert.equal(matchesRollTags({ roll_tags: "sense.vision" }, vector), false);
});

test("novos qualificadores combinam com finalidades principais e a busca cobre variações", () => {
  const ids = ["resist_incapacitation", "sensory_vector_vision", "inhaled_agent", "unnecessary_risk"];
  assert.deepEqual(resolveRollMetadata({ purposeIds: ids }).purposeIds, ids);
  for (const id of ids.slice(1)) assert.equal(ROLL_PURPOSES.find(p => p.id === id).role, "qualifier");
  for (const [query, id] of [["MEMÓRIA", "memorize"], ["memoria", "memorize"], ["fumaca", "inhaled_agent"], ["álcool", "resist_alcohol"], ["saudavel", "healthy_appearance"]]) {
    assert.ok(searchRollPurposes(query).some(p => p.id === id), `${query} -> ${id}`);
  }
});

test("quick view expõe tags diretas, herdadas, tipo e ajuda das novas finalidades", () => {
  const smell = buildPurposeQuickView("sense_smell");
  assert.deepEqual(smell.directTags, ["sense.smell"]);
  assert.ok(smell.inheritedTags.includes("sense.smell_taste"));
  assert.ok(smell.distinctions.length && smell.references.length);
  const vector = buildPurposeQuickView("sensory_vector_smell");
  assert.equal(vector.groupLabel, "Vetores e Agentes");
  assert.equal(vector.roleLabel, "Qualificador");
  assert.ok(vector.inheritedTags.includes("vector.sensory.smell_taste"));
});
