export const GM_MODIFIER_CATEGORY_OPTIONS = [
    { id: "location", label: "Pontos de Impacto" },
    { id: "maneuver", label: "Manobras" },
    { id: "attack_opt", label: "Opções de Ataque" },
    { id: "defense_opt", label: "Opções de Defesa" },
    { id: "posture", label: "Cobertura e Postura" },
    { id: "range", label: "Distância e Velocidade" },
    { id: "terrain_light", label: "Terreno e Iluminação" },
    { id: "state_affliction", label: "Estado e Atribulações" },
    { id: "task_difficulty", label: "Dificuldade da Tarefa" },
    { id: "ritual", label: "Operação Mágica" },
    { id: "power_operation", label: "Operação de Poderes" },
    { id: "time", label: "Modo de Execução" },
    { id: "effort", label: "Esforço Adicional" },
    { id: "situation", label: "Cenário" },
    { id: "equipment", label: "Equipamento" },
    { id: "other", label: "Customizado" }
];

const CATEGORY_LABELS = new Map(GM_MODIFIER_CATEGORY_OPTIONS.map(category => [category.id, category.label]));

export function getGMModifierCategoryLabel(categoryId) {
    return CATEGORY_LABELS.get(categoryId) ?? CATEGORY_LABELS.get("other") ?? "Customizado";
}

export function normalizeGMModifierCategory(categoryId) {
    return CATEGORY_LABELS.has(categoryId) ? categoryId : "other";
}