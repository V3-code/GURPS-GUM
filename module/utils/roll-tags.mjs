export const ROLL_TAG_GROUPS = Object.freeze([
  ["tests", "Tipos gerais"], ["survival", "Ferimentos e sobrevivência"],
  ["physical_resistance", "Resistências físicas"], ["mental", "Mentais e comportamentais"],
  ["movement", "Equilíbrio, quedas e movimento"], ["environment", "Ambiente e fisiologia"],
  ["senses", "Sentidos"], ["supernatural", "Fontes e poderes"],
  ["social", "Sociais e comunicação"], ["vectors", "Vetores e agentes"],
  ["circumstances", "Circunstâncias"]
].map(([id, label]) => Object.freeze({ id, label })));

const definitions = [
  ["test.resistance","Resistência","tests"], ["test.survival","Sobrevivência","tests"], ["test.sense","Teste de sentidos","tests"],
  ["injury.knockdown_stun","Nocaute e atordoamento por ferimento","survival",["test.survival"]],
  ["injury.knockdown","Nocaute por ferimento","survival",["injury.knockdown_stun"]], ["injury.stun.physical","Atordoamento físico por ferimento","survival",["injury.knockdown_stun"]],
  ["recovery.stun.physical","Recuperação de atordoamento físico","survival",["test.survival"]], ["injury.stay_conscious","Manter a consciência","survival",["test.survival"]],
  ["recovery.consciousness","Recuperar a consciência","survival",["test.survival"]], ["injury.avoid_death","Evitar a morte","survival",["test.survival"]],
  ["injury.bleeding","Sangramento","survival",["test.survival"]], ["recovery.natural","Recuperação natural","survival",["test.survival"]],
  ["recovery.crippling","Recuperação de lesão incapacitante","survival",["test.survival"]], ["resistance.pain","Dor","survival",["test.resistance"]], ["resistance.torture","Tortura","survival",["test.resistance"]],
  ["resistance.physical","Resistência física","physical_resistance",["test.resistance"]], ["resistance.metabolic","Perigo metabólico","physical_resistance",["resistance.physical"]],
  ["resistance.poison","Veneno","physical_resistance",["resistance.metabolic"]], ["resistance.disease","Doença","physical_resistance",["resistance.metabolic"]],
  ["resistance.infection","Infecção","physical_resistance",["resistance.disease"]], ["resistance.addiction","Dependência/abstinência","physical_resistance",["resistance.metabolic"]],
  ["resistance.alcohol","Álcool","physical_resistance",["resistance.metabolic"]],
  ["resistance.paralysis","Paralisia","physical_resistance",["resistance.physical"]], ["resistance.incapacitation","Incapacitação","physical_resistance",["resistance.physical"]],
  ["resistance.unconsciousness","Sono, coma ou inconsciência","physical_resistance",["resistance.incapacitation"]], ["resistance.nausea","Náusea","physical_resistance",["resistance.physical"]], ["resistance.seizure","Convulsões","physical_resistance",["resistance.physical"]],
  ["resistance.mental","Resistência mental","mental",["test.resistance"]], ["resistance.fear","Medo","mental",["resistance.mental"]], ["mental.fright_check","Verificação de pânico","mental",["resistance.fear"]],
  ["resistance.intimidation","Intimidação","mental",["resistance.mental"]], ["mental.stun.avoid","Evitar atordoamento mental","mental"], ["mental.stun.recover","Recuperar atordoamento mental","mental"],
  ["mental.self_control","Autocontrole","mental"], ["resistance.mental_influence","Influência mental","mental",["resistance.mental"]], ["resistance.possession","Possessão","mental",["resistance.mental"]],
  ["mental.concentration","Concentração","mental"], ["resistance.confusion","Confusão ou alucinação","mental",["resistance.mental"]],
  ["mental.memory","Memória","mental"], ["mental.memory.memorize","Memorizar","mental",["mental.memory"]], ["mental.memory.recall","Recordar","mental",["mental.memory"]],
  ["mental.task.prolonged","Tarefa Mental Prolongada","mental"], ["mental.creativity","Criatividade e Inventividade","mental"],
  ["movement.balance","Equilíbrio","movement"], ["movement.avoid_fall","Evitar queda","movement"], ["movement.controlled_fall","Queda controlada","movement"], ["movement.takedown","Derrubada","movement"],
  ["movement.knockback_fall","Permanecer de pé após projeção","movement"], ["movement.mounted","Permanecer montado","movement"], ["movement.break_free","Libertar-se","movement"],
  ["resistance.environmental","Resistência ambiental","environment",["resistance.physical"]],
  ...["suffocation","exertion","heat","cold","altitude","pressure","vacuum","radiation","acceleration","sleep_deprivation"].map(id => [`environment.${id}`, id.replaceAll("_"," "), "environment", ["resistance.environmental"]]),
  ["environment.sleep_rest","Adormecer ou obter descanso","environment"], ["environment.aging","Envelhecimento","environment",["resistance.physical"]],
  ["sense.general","Sentidos em geral","senses",["test.sense"]], ["sense.vision","Visão","senses",["sense.general"]], ["sense.hearing","Audição","senses",["sense.general"]],
  ["sense.smell_taste","Paladar ou olfato","senses",["sense.general"]], ["sense.smell","Olfato","senses",["sense.smell_taste"]], ["sense.taste","Paladar","senses",["sense.smell_taste"]], ["sense.touch","Tato","senses",["sense.general"]], ["sense.detection","Detecção","senses",["sense.general"]],
  ["resistance.supernatural","Resistência sobrenatural","supernatural",["test.resistance"]], ["resistance.magic","Magia","supernatural",["resistance.supernatural"]],
  ["resistance.psionic","Psiquismo","supernatural",["resistance.supernatural"]], ["resistance.telepathy","Telepatia","supernatural",["resistance.psionic"]], ["resistance.power","Poder","supernatural",["resistance.supernatural"]],
  ["source.supernatural","Fonte sobrenatural","supernatural"], ["source.magic","Fonte mágica","supernatural",["source.supernatural"]], ["source.psionic","Fonte psiônica","supernatural",["source.supernatural"]],
  ["source.telepathic","Fonte telepática","supernatural",["source.psionic"]], ["source.power","Fonte de poder","supernatural",["source.supernatural"]],
  ["social.reaction","Reação","social"], ["social.influence","Influência","social"], ["social.resist_deception","Resistir a enganação","social"], ["social.resist_interrogation","Resistir a interrogatório","social"],
  ["communication.be_heard","Fazer-se Ouvir","social"], ["social.appear_honest","Parecer Honesto ou Confiável","social"], ["social.fashion","Moda e Estilo","social"], ["social.healthy_appearance","Aparência Saudável","social"],
  ["vector.sensory","Ataque por canal sensorial","vectors"], ["vector.sensory.vision","Canal visual","vectors",["vector.sensory"]], ["vector.sensory.hearing","Canal auditivo","vectors",["vector.sensory"]],
  ["vector.sensory.smell_taste","Canal olfativo ou gustativo","vectors",["vector.sensory"]], ["vector.sensory.smell","Canal Olfativo","vectors",["vector.sensory.smell_taste"]], ["vector.sensory.taste","Canal Gustativo","vectors",["vector.sensory.smell_taste"]], ["vector.sensory.touch","Canal tátil","vectors",["vector.sensory"]],
  ["vector.inhaled","Agente Inalado","vectors"], ["risk.unnecessary","Risco Desnecessário","circumstances"]
];

export const ROLL_TAG_CATALOG = Object.freeze(definitions.map(([id,label,group,parents=[]]) => Object.freeze({ id, label, group, parents, selectable: true, description: `Rolagens relacionadas a ${label.toLowerCase()}.` })));
const TAG_BY_ID = new Map(ROLL_TAG_CATALOG.map(tag => [tag.id, tag]));
export const ROLL_TAG_ALIASES = Object.freeze({
  knockdown:"injury.knockdown", stun:"injury.stun.physical", injury:"injury.knockdown_stun", unconsciousness:"injury.stay_conscious", death:"injury.avoid_death", survival:"test.survival",
  pain:"resistance.pain", resistance:"test.resistance", poison:"resistance.poison", disease:"resistance.disease", paralysis:"resistance.paralysis", incapacitation:"resistance.incapacitation",
  fright:"mental.fright_check", fear:"resistance.fear", intimidation:"resistance.intimidation", vision:"sense.vision", hearing:"sense.hearing", taste:"sense.smell_taste", smell:"sense.smell_taste", touch:"sense.touch"
});

const splitTags = value => Array.isArray(value) ? value : value ? String(value).split(",") : [];
export function normalizeRollTags(value) {
  const seen = new Set();
  return splitTags(value).map(tag => String(tag).trim().toLowerCase()).filter(Boolean).map(tag => ROLL_TAG_ALIASES[tag] || tag).filter(tag => !seen.has(tag) && seen.add(tag));
}
export function expandRollTags(value) {
  const result = [], seen = new Set();
  const visit = id => { if (seen.has(id)) return; seen.add(id); result.push(id); for (const parent of TAG_BY_ID.get(id)?.parents || []) visit(parent); };
  normalizeRollTags(value).forEach(visit);
  return result;
}
export function matchesRollTags(filter, rollTags = []) {
  const required = normalizeRollTags(filter?.roll_tags ?? filter?.rollTags);
  if (!required.length) return true;
  const present = new Set(expandRollTags(rollTags));
  return String(filter?.roll_tag_match ?? filter?.rollTagMatch ?? "any").toLowerCase() === "all" ? required.every(tag => present.has(tag)) : required.some(tag => present.has(tag));
}
export const isKnownRollTag = id => TAG_BY_ID.has(normalizeRollTags([id])[0]);
export const getRollTagLabel = id => TAG_BY_ID.get(normalizeRollTags([id])[0])?.label || String(id || "");
export function getGroupedRollTags(selectedTags = []) {
  const selected = new Set(normalizeRollTags(selectedTags));
  return ROLL_TAG_GROUPS.map(group => ({ ...group, tags: ROLL_TAG_CATALOG.filter(tag => tag.group === group.id && tag.selectable).map(tag => ({ ...tag, selected: selected.has(tag.id) })) }));
}