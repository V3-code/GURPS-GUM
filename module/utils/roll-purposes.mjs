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
    "id": "vectors",
    "label": "Vetores e Agentes"
  },
  {
    "id": "social",
    "label": "Sociais"
  },
  {
    "id": "circumstances",
    "label": "Circunstâncias"
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
  {"id": "resist_alcohol", "label": "Resistência ao Álcool", "shortLabel": "Resistência ao Álcool", "group": "resistances", "tags": ["resistance.alcohol"], "suggestedAttributes": ["ht"], "role": "primary", "description": "Use ao resistir aos efeitos do álcool e da embriaguez.", "keywords": ["álcool", "alcool", "bebida", "embriaguez"]},
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
  {"id": "memorize", "label": "Memorizar", "shortLabel": "Memorizar", "group": "mental", "tags": ["mental.memory.memorize"], "suggestedAttributes": ["iq"], "role": "primary", "description": "Use ao fixar deliberadamente informações novas na memória.", "keywords": ["memorizar", "decorar", "memória", "memoria"]},
  {"id": "recall_information", "label": "Recordar Informação", "shortLabel": "Recordar Informação", "group": "mental", "tags": ["mental.memory.recall"], "suggestedAttributes": ["iq"], "role": "primary", "description": "Use ao lembrar ou recuperar uma informação já aprendida.", "keywords": ["lembrar", "recordação", "recordacao", "memória", "memoria"]},
  {"id": "prolonged_mental_task", "label": "Tarefa Mental Prolongada", "shortLabel": "Tarefa Mental Prolongada", "group": "mental", "tags": ["mental.task.prolonged"], "suggestedAttributes": ["iq"], "role": "primary", "description": "Use para uma tarefa intelectual que exige esforço sustentado por longo período.", "keywords": ["tarefa", "mental", "prolongada", "persistência", "persistencia"]},
  {"id": "creativity", "label": "Criatividade/Inventividade", "shortLabel": "Criatividade/Inventividade", "group": "mental", "tags": ["mental.creativity"], "suggestedAttributes": ["iq"], "role": "primary", "description": "Use para criar, improvisar ou encontrar uma solução inventiva.", "keywords": ["inventar", "criatividade", "inventividade", "improvisar"]},
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
  {"id": "sense_smell", "label": "Olfato", "shortLabel": "Olfato", "group": "senses", "tags": ["sense.smell"], "suggestedAttributes": ["per"], "role": "primary", "description": "Use para perceber, identificar ou discriminar cheiros pelo olfato.", "keywords": ["olfato", "cheiro", "olfativo"]},
  {"id": "sense_taste", "label": "Paladar", "shortLabel": "Paladar", "group": "senses", "tags": ["sense.taste"], "suggestedAttributes": ["per"], "role": "primary", "description": "Use para perceber, identificar ou discriminar sabores pelo paladar.", "keywords": ["paladar", "gosto", "sabor", "gustativo"]},
  {"id": "sense_touch", "label": "Tato", "shortLabel": "Tato", "group": "senses", "tags": ["sense.touch"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a tato."},
  {"id": "sense_detection", "label": "Detecção", "shortLabel": "Detecção", "group": "senses", "tags": ["sense.detection"], "suggestedAttributes": ["per"], "role": "primary", "description": "Teste relacionado a detecção."},
  {"id": "resist_magic", "label": "Resistência à Magia", "shortLabel": "Resistência à Magia", "group": "sources", "tags": ["resistance.magic", "source.magic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_psionic", "label": "Resistência Psiônica", "shortLabel": "Resistência Psiônica", "group": "sources", "tags": ["resistance.psionic", "source.psionic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_supernatural_power", "label": "Resistência Sobrenatural", "shortLabel": "Resistência Sobrenatural", "group": "sources", "tags": ["resistance.supernatural", "source.supernatural"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_power", "label": "Resistência a Poder", "shortLabel": "Resistência a Poder", "group": "sources", "tags": ["resistance.power", "source.power"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "resist_telepathy", "label": "Resistência Telepática", "shortLabel": "Resistência Telepática", "group": "sources", "tags": ["resistance.telepathy", "source.telepathic"], "suggestedAttributes": ["vont"], "role": "qualifier", "description": "Qualificador para resistência direta à fonte; não se aplica automaticamente a consequências físicas indiretas."},
  {"id": "sensory_vector_vision", "label": "Ataque por Canal Visual", "shortLabel": "Canal Visual", "group": "vectors", "tags": ["vector.sensory.vision"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o ataque ou efeito chega pelo canal visual.", "keywords": ["visual", "visão", "visao"]},
  {"id": "sensory_vector_hearing", "label": "Ataque por Canal Auditivo", "shortLabel": "Canal Auditivo", "group": "vectors", "tags": ["vector.sensory.hearing"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o ataque ou efeito chega pelo canal auditivo.", "keywords": ["auditivo", "audição", "audicao", "ouvir"]},
  {"id": "sensory_vector_smell", "label": "Ataque por Canal Olfativo", "shortLabel": "Canal Olfativo", "group": "vectors", "tags": ["vector.sensory.smell"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o ataque ou efeito chega especificamente pelo olfato.", "keywords": ["olfativo", "olfato", "cheiro"]},
  {"id": "sensory_vector_taste", "label": "Ataque por Canal Gustativo", "shortLabel": "Canal Gustativo", "group": "vectors", "tags": ["vector.sensory.taste"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o ataque ou efeito chega especificamente pelo paladar.", "keywords": ["gustativo", "paladar", "gosto"]},
  {"id": "sensory_vector_touch", "label": "Ataque por Canal Tátil", "shortLabel": "Canal Tátil", "group": "vectors", "tags": ["vector.sensory.touch"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o ataque ou efeito chega pelo contato ou canal tátil.", "keywords": ["tátil", "tatil", "toque"]},
  {"id": "sensory_vector_smell_taste", "label": "Ataque por Canal Olfativo ou Gustativo", "shortLabel": "Canal Olfativo/Gustativo", "group": "vectors", "tags": ["vector.sensory.smell_taste"], "suggestedAttributes": [], "role": "qualifier", "description": "Use para um vetor comum que pode agir pelo olfato ou pelo paladar.", "keywords": ["olfativo", "gustativo", "olfato", "paladar"]},
  {"id": "inhaled_agent", "label": "Agente Inalado", "shortLabel": "Agente Inalado", "group": "vectors", "tags": ["vector.inhaled"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando gás, fumaça ou outro agente precisa ser respirado ou inalado.", "keywords": ["respirar", "inalar", "gás", "gas", "fumaça", "fumaca"]},
  {"id": "reaction_roll", "label": "Teste de Reação", "shortLabel": "Teste de Reação", "group": "social", "tags": ["social.reaction"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a teste de reação."},
  {"id": "influence_roll", "label": "Teste de Influência", "shortLabel": "Teste de Influência", "group": "social", "tags": ["social.influence"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a teste de influência."},
  {"id": "resist_deception", "label": "Resistência a Enganação", "shortLabel": "Resistência a Enganação", "group": "social", "tags": ["social.resist_deception"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a resistência a enganação."},
{"id": "resist_interrogation", "label": "Resistência a Interrogatório", "shortLabel": "Resistência a Interrogatório", "group": "social", "tags": ["social.resist_interrogation"], "suggestedAttributes": [], "role": "primary", "description": "Teste relacionado a resistência a interrogatório."}
  ,{"id": "be_heard", "label": "Fazer-se Ouvir", "shortLabel": "Fazer-se Ouvir", "group": "social", "tags": ["communication.be_heard"], "suggestedAttributes": [], "role": "primary", "description": "Use para projetar a voz e fazer-se ouvir apesar da distância ou do ruído.", "keywords": ["voz", "grito", "ouvir"]}
  ,{"id": "appear_honest", "label": "Parecer Honesto/Confiável", "shortLabel": "Parecer Honesto", "group": "social", "tags": ["social.appear_honest"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando parecer sincero, honesto ou confiável for relevante ao teste social.", "keywords": ["sincero", "honesto", "confiável", "confiavel"]}
  ,{"id": "fashion_context", "label": "Moda e Estilo", "shortLabel": "Moda e Estilo", "group": "social", "tags": ["social.fashion"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando conhecimento, apresentação ou adequação à moda e ao estilo forem relevantes.", "keywords": ["moda", "estilo"]}
  ,{"id": "healthy_appearance", "label": "Aparência Saudável", "shortLabel": "Aparência Saudável", "group": "social", "tags": ["social.healthy_appearance"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando uma aparência de saúde e vitalidade influenciar o teste social.", "keywords": ["saúde", "saude", "saudável", "saudavel", "aparência", "aparencia"]}
  ,{"id": "unnecessary_risk", "label": "Risco Desnecessário", "shortLabel": "Risco Desnecessário", "group": "circumstances", "tags": ["risk.unnecessary"], "suggestedAttributes": [], "role": "qualifier", "description": "Use quando o personagem assume voluntariamente um risco desnecessário e significativo.", "keywords": ["risco", "perigo", "ousadia"]}
];
// Conteúdo editorial opcional da ajuda contextual. As tags mecânicas continuam
// sendo definidas exclusivamente no catálogo acima e na hierarquia central.
const PURPOSE_HELP = {
  general: { description: "Finalidade neutra utilizada quando nenhuma finalidade mecânica específica foi selecionada. Não produz tags semânticas e não ativa modificadores filtrados por finalidade." },
  knockdown_stun: {
    description: "Teste imediato de HT provocado por ferimento grave ou por determinados ferimentos na cabeça ou nos órgãos vitais. Um fracasso provoca nocaute e atordoamento físico. Um fracasso por 5 ou mais ou uma falha crítica também pode provocar perda da consciência.",
    distinctions: ["Recuperar-se posteriormente do atordoamento físico.", "Manter a consciência com 0 PV ou menos.", "Recuperar a consciência.", "Resistir diretamente a sono, coma ou inconsciência.", "Permanecer de pé depois de uma projeção."],
    recommendedFilterTags: ["injury.knockdown_stun"]
  },
  recover_physical_stun: { distinctions: ["O teste inicial de nocaute e atordoamento provocado pelo ferimento."] },
  consciousness: { distinctions: ["Recuperar a consciência depois de já estar inconsciente."] },
  regain_consciousness: { distinctions: ["Testes para permanecer consciente."] },
  resist_unconsciousness: { distinctions: ["Inconsciência provocada por fracasso em testes decorrentes de ferimentos."] },
  avoid_mental_stun: { distinctions: ["Atordoamento físico provocado por ferimentos."] },
  recover_mental_stun: { distinctions: ["Recuperação de atordoamento físico."] },
  fright_check: {
    description: "Teste realizado diante de uma situação aterrorizante ou psicologicamente traumática.",
    distinctions: ["Todo e qualquer teste genérico contra medo; Resistência ao Medo pode abranger situações que não usam especificamente uma Verificação de Pânico."],
    recommendedFilterTags: ["mental.fright_check"], references: ["Módulo Básico, Verificações de Pânico"]
  },
  memorize: { distinctions: ["Recordar informação já aprendida; memorizar é o ato de fixar conteúdo novo."], recommendedFilterTags: ["mental.memory.memorize", "mental.memory"], references: ["Memória Eidética/Memória Fotográfica"] },
  recall_information: { distinctions: ["Memorizar conteúdo novo; recordar recupera algo já aprendido."], recommendedFilterTags: ["mental.memory.recall", "mental.memory"], references: ["Memória Eidética/Memória Fotográfica"] },
  prolonged_mental_task: { distinctions: ["Um teste mental breve ou uma simples manutenção de concentração."], references: ["Obstinado"] },
  creativity: { distinctions: ["Recordar conhecimento ou apenas executar uma técnica conhecida."], references: ["Versátil"] },
  resist_fear: { distinctions: ["Verificação de Pânico: esta finalidade pode abranger testes contra medo que não utilizem especificamente essas regras."] },
  avoid_fall: { distinctions: ["Amortecer uma queda que já ocorreu."] },
  controlled_fall: { distinctions: ["Evitar uma queda; esta finalidade é usada depois que a queda já está ocorrendo."] },
  resist_takedown: { distinctions: ["Projeção causada por dano."] },
  resist_knockback_fall: { distinctions: ["O cálculo da distância de projeção."] },
  sense_general: { distinctions: ["Resistência a ataques que utilizam um sentido como vetor."] },
  sense_vision: { distinctions: ["Resistência a ataques que utilizam a visão como vetor."] },
  sense_hearing: { distinctions: ["Resistência a ataques que utilizam a audição como vetor."] },
  sense_taste_smell: { distinctions: ["Resistência a ataques que utilizam paladar ou olfato como vetor."] },
  sense_smell: { distinctions: ["Teste apenas de paladar.", "Ataque que usa o olfato como vetor; testar um sentido não é resistir por esse canal."], recommendedFilterTags: ["sense.smell", "sense.smell_taste"], references: ["Olfato Discriminatório e Olfato Aguçado"] },
  sense_taste: { distinctions: ["Teste apenas de olfato.", "Ataque que usa o paladar como vetor; testar um sentido não é resistir por esse canal."], recommendedFilterTags: ["sense.taste", "sense.smell_taste"], references: ["Paladar Discriminatório e Paladar Aguçado"] },
  
  sense_touch: { distinctions: ["Resistência a ataques que utilizam o tato como vetor."] },
  resist_magic: { distinctions: ["Consequências físicas indiretas de uma magia; esta finalidade representa resistência direta à influência mágica."], recommendedFilterTags: ["resistance.magic"] },
  resist_alcohol: { distinctions: ["Resistência geral a outros perigos metabólicos ou dependência/abstinência."], recommendedFilterTags: ["resistance.alcohol", "resistance.metabolic"], references: ["Tolerância ao Álcool"] },
  sensory_vector_vision: { distinctions: ["Teste de Visão; o vetor descreve como um ataque chega, não qual sentido está sendo testado."], references: ["Sentido Protegido"] },
  sensory_vector_hearing: { distinctions: ["Teste de Audição; o vetor descreve como um ataque chega, não qual sentido está sendo testado."], references: ["Sentido Protegido"] },
  sensory_vector_smell: { distinctions: ["Teste de Olfato e canal gustativo."], recommendedFilterTags: ["vector.sensory.smell", "vector.sensory.smell_taste"], references: ["Sentido Protegido"] },
  sensory_vector_taste: { distinctions: ["Teste de Paladar e canal olfativo."], recommendedFilterTags: ["vector.sensory.taste", "vector.sensory.smell_taste"], references: ["Sentido Protegido"] },
  sensory_vector_touch: { distinctions: ["Teste de Tato."], references: ["Sentido Protegido"] },
  sensory_vector_smell_taste: { distinctions: ["Teste de Olfato ou Paladar; esta é uma categoria de vetor de ataque."], references: ["Sentido Protegido"] },
  inhaled_agent: { distinctions: ["Sufocamento sem agente inalado e ataques que atuam apenas por um sentido."], references: ["Pulmões com Filtro"] },
  be_heard: { distinctions: ["Teste de Audição de quem escuta e teste social cujo conteúdo, não o alcance da voz, seja o foco."], references: ["Voz Penetrante"] },
  appear_honest: { distinctions: ["Ser objetivamente verdadeiro; este qualificador descreve a impressão transmitida."], references: ["Rosto Sincero"] },
  fashion_context: { distinctions: ["Reação social geral sem relação com moda ou estilo."], references: ["Por Dentro da Moda"] },
  healthy_appearance: { distinctions: ["Resistência a doença; aqui importa somente a aparência social de saúde."], references: ["Metabolismo Impoluto"] },
  unnecessary_risk: { distinctions: ["Perigo inevitável ou risco necessário para alcançar o objetivo."], references: ["Venturoso"] }
};
for (const purpose of ROLL_PURPOSES) {
  Object.assign(purpose, PURPOSE_HELP[purpose.id] || {});
  purpose.suggestedBases = [...purpose.suggestedAttributes];
}
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