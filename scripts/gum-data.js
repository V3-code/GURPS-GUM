// scripts/gum-data.js

export const GUM_DATA = {
    /**
     * Um dicionário que mapeia caminhos de dados do sistema para nomes amigáveis.
     * Isso alimenta os menus dropdown na ficha de condição para torná-la user-friendly.
     * A chave é o caminho do atributo que será usado na fórmula (ex: @attributes.st.value).
     * O valor é o texto que o Mestre verá no menu.
     */
    attributes: {
        // Atributos Primários (Mod. Temp.)
        "attributes.st.temp": "ST (Mod. Temp.)",
        "attributes.dx.temp": "DX (Mod. Temp.)",
        "attributes.iq.temp": "IQ (Mod. Temp.)",
        "attributes.ht.temp": "HT (Mod. Temp.)",
        "attributes.vont.temp": "Vontade (Mod. Temp.)",
        "attributes.per.temp": "Percepção (Mod. Temp.)",
        
        // Atributos Secundários (Mod. Temp.)
        "attributes.hp.temp": "PV Máximos (Mod. Temp.)",
        "attributes.fp.temp": "PF Máximos (Mod. Temp.)",
        "attributes.lifting_st.temp": "ST de Carga (Mod. Temp.)",
        "attributes.mt.temp": "MT (Mod. Temp.)",
        "attributes.basic_speed.temp": "Velocidade Básica (Mod. Temp.)",
        "attributes.basic_move.temp": "Deslocamento Básico (Mod. Temp.)",
        "attributes.enhanced_move.temp": "Deslocamento Ampliado (Mod. Temp.)",
        
        // Atributos Calculados (Modificadores Diretos)
        "attributes.final_dodge": "Esquiva Final",
        "attributes.final_move": "Deslocamento Final",
        "attributes.enhanced_move.final": "Deslocamento Ampliado Final",
        
        // RD final por local (inclui armadura, manual, temporária, permanente e override)
        "combat.dr_locations.head.base": "RD Final - Crânio",
        "combat.dr_locations.face.base": "RD Final - Rosto",
        "combat.dr_locations.neck.base": "RD Final - Pescoço",
        "combat.dr_locations.torso.base": "RD Final - Torso",
        "combat.dr_locations.vitals.base": "RD Final - Órgãos Vitais",
        "combat.dr_locations.groin.base": "RD Final - Virilha",
        "combat.dr_locations.arm_l.base": "RD Final - Braço Esquerdo",
        "combat.dr_locations.arm_r.base": "RD Final - Braço Direito",
        "combat.dr_locations.hand_l.base": "RD Final - Mão Esquerda",
        "combat.dr_locations.hand_r.base": "RD Final - Mão Direita",
        "combat.dr_locations.leg_l.base": "RD Final - Perna Esquerda",
        "combat.dr_locations.leg_r.base": "RD Final - Perna Direita",
        "combat.dr_locations.foot_l.base": "RD Final - Pé Esquerdo",
        "combat.dr_locations.foot_r.base": "RD Final - Pé Direito",
        "combat.dr_locations.eyes.base": "RD Final - Olhos",
        
        // Valores Calculados Finais (da sua função _prepareCharacterItems)
        "attributes.st.final": "ST Final",
        "attributes.dx.final": "DX Final",
        "attributes.iq.final": "IQ Final",
        "attributes.ht.final": "HT Final",
        "attributes.vont.final": "Vontade Final",
        "attributes.per.final": "Percepção Final",
        "attributes.final_dodge": "Esquiva Final",
        "attributes.final_move": "Deslocamento Final",
        "encumbrance.level_value": "Nível de Carga (0-4)",
        "encumbrance.penalty": "Penalidade de Carga (0 a -4)"
    },

    /**
     * Os operadores de comparação que o Mestre poderá escolher.
     */
    operators: {
        "==": "Igual a",
        "!=": "Diferente de",
        "<": "Menor que",
        "<=": "Menor ou Igual a",
        ">": "Maior que",
        ">=": "Maior ou Igual a"
    }
};