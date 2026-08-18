import { expandRollTags, matchesRollTags, normalizeRollTags } from "./roll-tags.mjs";

export const ROLL_PURPOSE_GROUPS = Object.freeze([
  {
    "id": "general",
    "label": "Geral"
  },
  {
    "id": "survival",
    "label": "Ferimentos e Sobrevivência"
  },
  {
    "id": "resistances",
    "label": "Resistências Físicas"
  },
  {
    "id": "mental",
    "label": "Mentais e Comportamentais"
  },
  {
    "id": "movement",
    "label": "Equilíbrio, Quedas e Movimento"
  },
  {
    "id": "environment",
    "label": "Ambiente e Fisiologia"
  },
  {
    "id": "senses",
    "label": "Sensoriais"
  },
  {
    "id": "sources",
    "label": "Fontes e Poderes"
  },
  {
    "id": "social",
    "label": "Sociais"
  }
]);
export const ROLL_PURPOSES = [
  {"id": "general", "label": "Teste Geral", "shortLabel": "Teste Geral", "group": "general", "tags": [], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a teste geral."},
  {"id": "knockdown_stun", "label": "Nocaute e Atordoamento por Ferimento", "shortLabel": "Nocaute e Atordoamento por Ferimento", "group": "survival", "tags": ["injury.knockdown", "injury.stun.physical"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a nocaute e atordoamento por ferimento."},
  {"id": "recover_physical_stun", "label": "Recuperar-se de Atordoamento Físico", "shortLabel": "Recuperar-se de Atordoamento Físico", "group": "survival", "tags": ["recovery.stun.physical"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a recuperar-se de atordoamento físico."},
  {"id": "consciousness", "label": "Manter a Consciência", "shortLabel": "Manter a Consciência", "group": "survival", "tags": ["injury.stay_conscious"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a manter a consciência."},
  {"id": "regain_consciousness", "label": "Recuperar a Consciência", "shortLabel": "Recuperar a Consciência", "group": "survival", "tags": ["recovery.consciousness"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a recuperar a consciência."},
  {"id": "death", "label": "Evitar a Morte", "shortLabel": "Evitar a Morte", "group": "survival", "tags": ["injury.avoid_death"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a evitar a morte."},
  {"id": "resist_bleeding", "label": "Resistir a Sangramento", "shortLabel": "Resistir a Sangramento", "group": "survival", "tags": ["injury.bleeding"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistir a sangramento."},
  {"id": "natural_recovery", "label": "Recuperação Natural", "shortLabel": "Recuperação Natural", "group": "survival", "tags": ["recovery.natural"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a recuperação natural."},
  {"id": "crippling_recovery", "label": "Recuperação de Lesão Incapacitante", "shortLabel": "Recuperação de Lesão Incapacitante", "group": "survival", "tags": ["recovery.crippling"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a recuperação de lesão incapacitante."},
  {"id": "pain", "label": "Resistir à Dor", "shortLabel": "Resistir à Dor", "group": "survival", "tags": ["resistance.pain"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistir à dor."},
  {"id": "resist_torture", "label": "Resistir à Tortura", "shortLabel": "Resistir à Tortura", "group": "survival", "tags": ["resistance.torture"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistir à tortura."},
  {"id": "resist_metabolic_hazard", "label": "Perigo Metabólico", "shortLabel": "Perigo Metabólico", "group": "resistances", "tags": ["resistance.metabolic"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a perigo metabólico."},
  {"id": "resist_poison", "label": "Resistência a Veneno", "shortLabel": "Resistência a Veneno", "group": "resistances", "tags": ["resistance.poison"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a veneno."},
  {"id": "resist_disease", "label": "Resistência a Doença", "shortLabel": "Resistência a Doença", "group": "resistances", "tags": ["resistance.disease"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a doença."},
  {"id": "resist_infection", "label": "Resistência a Infecção", "shortLabel": "Resistência a Infecção", "group": "resistances", "tags": ["resistance.infection"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a infecção."},
  {"id": "resist_paralysis", "label": "Resistência a Paralisia", "shortLabel": "Resistência a Paralisia", "group": "resistances", "tags": ["resistance.paralysis"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a paralisia."},
  {"id": "resist_incapacitation", "label": "Resistência a Atribulação/Incapacitação", "shortLabel": "Resistência a Atribulação/Incapacitação", "group": "resistances", "tags": ["resistance.incapacitation"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a atribulação/incapacitação."},
  {"id": "resist_unconsciousness", "label": "Resistência a Sono/Inconsciência/Coma", "shortLabel": "Resistência a Sono/Inconsciência/Coma", "group": "resistances", "tags": ["resistance.unconsciousness"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a sono/inconsciência/coma."},
  {"id": "resist_nausea", "label": "Resistência a Náusea", "shortLabel": "Resistência a Náusea", "group": "resistances", "tags": ["resistance.nausea"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a náusea."},
  {"id": "resist_seizure", "label": "Resistência a Convulsões", "shortLabel": "Resistência a Convulsões", "group": "resistances", "tags": ["resistance.seizure"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a convulsões."},
  {"id": "resist_addiction", "label": "Dependência/Abstinência", "shortLabel": "Dependência/Abstinência", "group": "resistances", "tags": ["resistance.addiction"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a dependência/abstinência."},
  {"id": "fright_check", "label": "Verificação de Pânico", "shortLabel": "Verificação de Pânico", "group": "mental", "tags": ["mental.fright_check"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a verificação de pânico."},
  {"id": "resist_fear", "label": "Resistência ao Medo", "shortLabel": "Resistência ao Medo", "group": "mental", "tags": ["resistance.fear"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a resistência ao medo."},
  {"id": "resist_intimidation", "label": "Resistência à Intimidação", "shortLabel": "Resistência à Intimidação", "group": "mental", "tags": ["resistance.intimidation"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a resistência à intimidação."},
  {"id": "avoid_mental_stun", "label": "Evitar Atordoamento Mental", "shortLabel": "Evitar Atordoamento Mental", "group": "mental", "tags": ["mental.stun.avoid"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a evitar atordoamento mental."},
  {"id": "recover_mental_stun", "label": "Recuperar-se de Atordoamento Mental", "shortLabel": "Recuperar-se de Atordoamento Mental", "group": "mental", "tags": ["mental.stun.recover"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a recuperar-se de atordoamento mental."},
  {"id": "self_control", "label": "Teste de Autocontrole", "shortLabel": "Teste de Autocontrole", "group": "mental", "tags": ["mental.self_control"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a teste de autocontrole."},
  {"id": "resist_mental_influence", "label": "Resistência a Influência Mental", "shortLabel": "Resistência a Influência Mental", "group": "mental", "tags": ["resistance.mental_influence"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a resistência a influência mental."},
  {"id": "resist_possession", "label": "Resistência a Possessão", "shortLabel": "Resistência a Possessão", "group": "mental", "tags": ["resistance.possession"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a resistência a possessão."},
  {"id": "maintain_concentration", "label": "Manter a Concentração", "shortLabel": "Manter a Concentração", "group": "mental", "tags": ["mental.concentration"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a manter a concentração."},
  {"id": "resist_confusion", "label": "Resistência a Confusão/Alucinação", "shortLabel": "Resistência a Confusão/Alucinação", "group": "mental", "tags": ["resistance.confusion"], "suggestedAttributes": ["vont"], "role": "primary", "description": "Teste relacionado a resistência a confusão/alucinação."},
  {"id": "maintain_balance", "label": "Manter o Equilíbrio", "shortLabel": "Manter o Equilíbrio", "group": "movement", "tags": ["movement.balance"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a manter o equilíbrio."},
  {"id": "avoid_fall", "label": "Evitar uma Queda", "shortLabel": "Evitar uma Queda", "group": "movement", "tags": ["movement.avoid_fall"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a evitar uma queda."},
  {"id": "controlled_fall", "label": "Queda Controlada/Amortecer Queda", "shortLabel": "Queda Controlada/Amortecer Queda", "group": "movement", "tags": ["movement.controlled_fall"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a queda controlada/amortecer queda."},
  {"id": "resist_takedown", "label": "Resistir a Queda/Derrubada", "shortLabel": "Resistir a Queda/Derrubada", "group": "movement", "tags": ["movement.takedown"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a resistir a queda/derrubada."},
  {"id": "resist_knockback_fall", "label": "Permanecer de Pé após Projeção", "shortLabel": "Permanecer de Pé após Projeção", "group": "movement", "tags": ["movement.knockback_fall"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a permanecer de pé após projeção."},
  {"id": "stay_mounted", "label": "Permanecer Montado", "shortLabel": "Permanecer Montado", "group": "movement", "tags": ["movement.mounted"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a permanecer montado."},
  {"id": "break_free", "label": "Libertar-se", "shortLabel": "Libertar-se", "group": "movement", "tags": ["movement.break_free"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a libertar-se."},
  {"id": "resist_suffocation", "label": "Resistência a Sufocamento", "shortLabel": "Resistência a Sufocamento", "group": "environment", "tags": ["environment.suffocation"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência a sufocamento."},
  {"id": "resist_exertion", "label": "Esforço/Fadiga", "shortLabel": "Esforço/Fadiga", "group": "environment", "tags": ["environment.exertion"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a esforço/fadiga."},
  {"id": "resist_heat", "label": "Resistência ao Calor", "shortLabel": "Resistência ao Calor", "group": "environment", "tags": ["environment.heat"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência ao calor."},
  {"id": "resist_cold", "label": "Resistência ao Frio", "shortLabel": "Resistência ao Frio", "group": "environment", "tags": ["environment.cold"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência ao frio."},
  {"id": "resist_altitude", "label": "Resistência à Altitude", "shortLabel": "Resistência à Altitude", "group": "environment", "tags": ["environment.altitude"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência à altitude."},
  {"id": "resist_pressure", "label": "Resistência à Pressão", "shortLabel": "Resistência à Pressão", "group": "environment", "tags": ["environment.pressure"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência à pressão."},
  {"id": "resist_vacuum", "label": "Resistência ao Vácuo", "shortLabel": "Resistência ao Vácuo", "group": "environment", "tags": ["environment.vacuum"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência ao vácuo."},
  {"id": "resist_radiation", "label": "Resistência à Radiação", "shortLabel": "Resistência à Radiação", "group": "environment", "tags": ["environment.radiation"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência à radiação."},
  {"id": "resist_acceleration", "label": "Resistência à Aceleração", "shortLabel": "Resistência à Aceleração", "group": "environment", "tags": ["environment.acceleration"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a resistência à aceleração."},
  {"id": "resist_sleep_deprivation", "label": "Privação de Sono", "shortLabel": "Privação de Sono", "group": "environment", "tags": ["environment.sleep_deprivation"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a privação de sono."},
  {"id": "sleep_rest", "label": "Adormecer/Obter Descanso", "shortLabel": "Adormecer/Obter Descanso", "group": "environment", "tags": ["environment.sleep_rest"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a adormecer/obter descanso."},
  {"id": "aging_check", "label": "Verificação de Envelhecimento", "shortLabel": "Verificação de Envelhecimento", "group": "environment", "tags": ["environment.aging"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Teste relacionado a verificação de envelhecimento."},
  {"id": "sense_general", "label": "Teste de Sentidos", "shortLabel": "Teste de Sentidos", "group": "senses", "tags": ["sense.general"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a teste de sentidos."},
  {"id": "sense_vision", "label": "Visão", "shortLabel": "Visão", "group": "senses", "tags": ["sense.vision"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a visão."},
  {"id": "sense_hearing", "label": "Audição", "shortLabel": "Audição", "group": "senses", "tags": ["sense.hearing"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a audição."},
  {"id": "sense_taste_smell", "label": "Paladar/Olfato", "shortLabel": "Paladar/Olfato", "group": "senses", "tags": ["sense.smell_taste"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a paladar/olfato."},
  {"id": "sense_touch", "label": "Tato", "shortLabel": "Tato", "group": "senses", "tags": ["sense.touch"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a tato."},
  {"id": "sense_detection", "label": "Detecção", "shortLabel": "Detecção", "group": "senses", "tags": ["sense.detection"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a detecção."},
  {"id": "resist_magic", "label": "Resistência à Magia", "shortLabel": "Resistência à Magia", "group": "sources", "tags": ["resistance.magic", "source.magic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_psionic", "label": "Resistência Psiônica", "shortLabel": "Resistência Psiônica", "group": "sources", "tags": ["resistance.psionic", "source.psionic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_supernatural_power", "label": "Resistência Sobrenatural", "shortLabel": "Resistência Sobrenatural", "group": "sources", "tags": ["resistance.supernatural", "source.supernatural"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_power", "label": "Resistência a Poder", "shortLabel": "Resistência a Poder", "group": "sources", "tags": ["resistance.power", "source.power"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_telepathy", "label": "Resistência Telepática", "shortLabel": "Resistência Telepática", "group": "sources", "tags": ["resistance.telepathy", "source.telepathic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "reaction_roll", "label": "Teste de Reação", "shortLabel": "Teste de Reação", "group": "social", "tags": ["social.reaction"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a teste de reação."},
  {"id": "influence_roll", "label": "Teste de Influência", "shortLabel": "Teste de Influência", "group": "social", "tags": ["social.influence"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a teste de influência."},
  {"id": "resist_deception", "label": "Resistência a Enganação", "shortLabel": "Resistência a Enganação", "group": "social", "tags": ["social.resist_deception"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a resistência a enganação."},
  {"id": "resist_interrogation", "label": "Resistência a Interrogatório", "shortLabel": "Resistência a Interrogatório", "group": "social", "tags": ["social.resist_interrogation"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a resistência a interrogatório."}
];
const PURPOSE_BY_ID = new Map(ROLL_PURPOSES.map(p => [p.id,p]));
export function normalizePurposeSearch(value="") { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(); }
export function searchRollPurposes(query="") {
  const terms=normalizePurposeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...ROLL_PURPOSES];
  return ROLL_PURPOSES.filter(purpose => {
    const searchable=[purpose.label,purpose.description,purpose.id,...(purpose.tags||[]),...(purpose.keywords||[])].map(normalizePurposeSearch).join(" ");
    return terms.every(term=>searchable.includes(term));
  });
}
export function registerRollPurpose(purpose) {
  if (!purpose?.id || !purpose?.label || !purpose?.group) throw new Error("Finalidade inválida: id, label e group são obrigatórios.");
  const normalized={...purpose,id:String(purpose.id).trim(),tags:normalizeRollTags(purpose.tags),keywords:[...new Set((Array.isArray(purpose.keywords)?purpose.keywords:[]).map(keyword=>String(keyword).trim()).filter(Boolean))],suggestedAttributes:normalizeRollTags(purpose.suggestedAttributes),role:purpose.role === "qualifier" ? "qualifier" : "primary",description:String(purpose.description||"")};
  const previous=PURPOSE_BY_ID.get(normalized.id); if(previous) ROLL_PURPOSES.splice(ROLL_PURPOSES.indexOf(previous),1,normalized); else ROLL_PURPOSES.push(normalized); PURPOSE_BY_ID.set(normalized.id,normalized); return normalized;
}
export function normalizePurposeIds(value) { const values=Array.isArray(value)?value:value?String(value).split(","):[]; return [...new Set(values.map(id=>String(id).trim()).filter(id=>id&&id!=="general"&&PURPOSE_BY_ID.has(id)))]; }
export function resolveRollMetadata({context="default",purposeIds=[],attributeKey=null}={}) { const ids=normalizePurposeIds(purposeIds); return {context:String(context||"default"),purposeIds:ids,rollTags:expandRollTags(ids.flatMap(id=>PURPOSE_BY_ID.get(id)?.tags||[])),attributeKey:attributeKey?String(attributeKey).toLowerCase():null}; }
export { matchesRollTags, normalizeRollTags };
export function shouldIncludeInPermanentNh(entry={}) { return String(entry.nh_display_mode||"roll_only")==="include_in_nh" && normalizeRollTags(entry.roll_tags??entry.rollTags).length===0; }
export function getPurposeLabels(ids=[],{short=false}={}) { return normalizePurposeIds(ids).map(id=>short?PURPOSE_BY_ID.get(id).shortLabel:PURPOSE_BY_ID.get(id).label); }
export function getGroupedRollPurposes(attributeKey=null,selectedIds=[],searchQuery="") { const selected=new Set(normalizePurposeIds(selectedIds)); const matches=new Set(searchRollPurposes(searchQuery).map(p=>p.id)); return ROLL_PURPOSE_GROUPS.map(group=>({...group,purposes:ROLL_PURPOSES.filter(p=>p.group===group.id&&matches.has(p.id)).map(p=>({...p,selected:p.id==="general"?selected.size===0:selected.has(p.id),suggested:Boolean(attributeKey&&p.suggestedAttributes.includes(String(attributeKey).toLowerCase())),tooltip:`${p.description}${p.suggestedAttributes.length?` Atributo usual: ${p.suggestedAttributes.map(k=>k==="vont"?"Vont":k.toUpperCase()).join("/")}.`:""}`}))})); }