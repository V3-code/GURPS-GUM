import test from "node:test"; 
import assert from "node:assert/strict"; 
import { ROLL_PURPOSES, getGroupedRollPurposes, getPurposeLabels, matchesRollTags, normalizePurposeIds, normalizePurposeSearch, registerRollPurpose, resolveRollMetadata, searchRollPurposes, shouldIncludeInPermanentNh } from "../module/utils/roll-purposes.mjs";

test("busca finalidades por texto, metadados e sem diferenciar acentos ou caixa", () => {
  assert.equal(normalizePurposeSearch("  NÁUSEA "), "nausea");
  assert.deepEqual(searchRollPurposes("NÁUSEA").map(p => p.id), ["resist_nausea"]);
  assert.ok(searchRollPurposes("resist_poison").some(p => p.id === "resist_poison"));
  assert.ok(searchRollPurposes("resistance.poison").some(p => p.id === "resist_poison"));
  assert.ok(searchRollPurposes("consequencias fisicas").some(p => p.id === "resist_magic"));
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

const requiredPurposes = `general knockdown_stun recover_physical_stun consciousness regain_consciousness death resist_bleeding natural_recovery crippling_recovery pain resist_torture resist_metabolic_hazard resist_poison resist_disease resist_infection resist_paralysis resist_incapacitation resist_unconsciousness resist_nausea resist_seizure resist_addiction fright_check resist_fear resist_intimidation avoid_mental_stun recover_mental_stun self_control resist_mental_influence resist_possession maintain_concentration resist_confusion maintain_balance avoid_fall controlled_fall resist_takedown resist_knockback_fall stay_mounted break_free resist_suffocation resist_exertion resist_heat resist_cold resist_altitude resist_pressure resist_vacuum resist_radiation resist_acceleration resist_sleep_deprivation sleep_rest aging_check sense_general sense_vision sense_hearing sense_taste_smell sense_touch sense_detection resist_magic resist_psionic resist_supernatural_power resist_power resist_telepathy reaction_roll influence_roll resist_deception resist_interrogation`.split(" ");

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
    assert.equal(positionedHeight, 356);
  } finally {
    PurposeQuickView.current = null;
    delete globalThis.Dialog;
    delete globalThis.requestAnimationFrame;
    delete globalThis.window;
  }
});