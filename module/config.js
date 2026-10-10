// systems/gum/module/config.js

// Este objeto conterá todas as configurações estáticas do nosso sistema.
export const GUM = {};

/**
 * A lista oficial de efeitos de status para o sistema GURPS.
 * Cada objeto contém:
 * - id: Um identificador único para o código (em inglês).
 * - name: O nome exibido para o jogador (em português).
 * - img: O caminho para o ícone correspondente.
 */
GUM.statusEffects = [
    { id: "shock_1", name: "GUM.Statuses.shock_1", img: "systems/gum/icons/status/shock_1.png" },
    { id: "shock_2", name: "GUM.Statuses.shock_2", img: "systems/gum/icons/status/shock_2.png" },
    { id: "shock_3", name: "GUM.Statuses.shock_3", img: "systems/gum/icons/status/shock_3.png" },
    { id: "shock_4", name: "GUM.Statuses.shock_4", img: "systems/gum/icons/status/shock_4.png" },
    { id: "bleeding", name: "GUM.Statuses.bleeding", img: "systems/gum/icons/status/bleeding.png" },
    { id: "poisoned", name: "GUM.Statuses.poisoned", img: "systems/gum/icons/status/poisoned.png" },
    { id: "burning", name: "GUM.Statuses.burning", img: "systems/gum/icons/status/burning.png" },
    { id: "flying", name: "GUM.Statuses.flying", img: "systems/gum/icons/status/flying.png" },
    { id: "stealth", name: "GUM.Statuses.stealth", img: "systems/gum/icons/status/stealth.png" },
    { id: "nauseated", name: "GUM.Statuses.nauseated", img: "systems/gum/icons/status/nauseated.png" },
    { id: "grappled", name: "GUM.Statuses.grappled", img: "systems/gum/icons/status/grappled.png" },
    { id: "fascinated", name: "GUM.Statuses.fascinated", img: "systems/gum/icons/status/fascinated.png" },
    { id: "exhausted", name: "GUM.Statuses.exhausted", img: "systems/gum/icons/status/exhausted.png" },
    { id: "blinded", name: "GUM.Statuses.blinded", img: "systems/gum/icons/status/blinded.png" },
    { id: "silenced", name: "GUM.Statuses.silenced", img: "systems/gum/icons/status/silenced.png" },
    { id: "drugged", name: "GUM.Statuses.drugged", img: "systems/gum/icons/status/drugged.png" },
    { id: "frightened", name: "GUM.Statuses.frightened", img: "systems/gum/icons/status/frightened.png" },
    { id: "suffocate", name: "GUM.Statuses.suffocate", img: "systems/gum/icons/status/suffocate.png" },
    { id: "deafened", name: "GUM.Statuses.deafened", img: "systems/gum/icons/status/deafened.png" },
    { id: "major_wound", name: "GUM.Statuses.major_wound", img: "systems/gum/icons/status/major_wound.png" },
    { id: "stunned", name: "GUM.Statuses.stunned", img: "systems/gum/icons/status/stunned.png" },
    { id: "reeling", name: "GUM.Statuses.reeling", img: "systems/gum/icons/status/reeling.png" },
    { id: "drunk_1", name: "GUM.Statuses.drunk_1", img: "systems/gum/icons/status/drunk_1.png" },
    { id: "drunk_2", name: "GUM.Statuses.drunk_2", img: "systems/gum/icons/status/drunk_2.png" },
    { id: "cough", name: "GUM.Statuses.cough", img: "systems/gum/icons/status/cough.png" },
    { id: "madness", name: "GUM.Statuses.madness", img: "systems/gum/icons/status/madness.png" },
    { id: "position_crouch", name: "GUM.Statuses.position_crouch", img: "systems/gum/icons/status/position_crouch.png" },
    { id: "position_crawl", name: "GUM.Statuses.position_crawl", img: "systems/gum/icons/status/position_crawl.png" },
    { id: "position_kneel", name: "GUM.Statuses.position_kneel", img: "systems/gum/icons/status/position_kneel.png" },
    { id: "position_standing", name: "GUM.Statuses.position_standing", img: "systems/gum/icons/status/position_standing.png" },
    { id: "position_sitting", name: "GUM.Statuses.position_sitting", img: "systems/gum/icons/status/position_sitting.png" },
    { id: "position_proned", name: "GUM.Statuses.position_proned", img: "systems/gum/icons/status/position_proned.png" },
    { id: "pain", name: "GUM.Statuses.pain", img: "systems/gum/icons/status/pain.png" },
    { id: "unconscious", name: "GUM.Statuses.unconscious", img: "systems/gum/icons/status/unconscious.png" },
    { id: "dead", name: "GUM.Statuses.dead", img: "systems/gum/icons/status/dead.png" },
    { id: "paralyze", name: "GUM.Statuses.paralyze", img: "systems/gum/icons/status/paralyze.png" },
    { id: "sleeping", name: "GUM.Statuses.sleeping", img: "systems/gum/icons/status/sleeping.png" },
    { id: "swimming", name: "GUM.Statuses.swimming", img: "systems/gum/icons/status/swimming.png" },
    { id: "wet", name: "GUM.Statuses.wet", img: "systems/gum/icons/status/wet.png" },
    { id: "num_1", name: "GUM.Statuses.num_1", img: "systems/gum/icons/status/num_1.png" },
    { id: "num_2", name: "GUM.Statuses.num_2", img: "systems/gum/icons/status/num_2.png" },
    { id: "num_3", name: "GUM.Statuses.num_3", img: "systems/gum/icons/status/num_3.png" }
    
];
