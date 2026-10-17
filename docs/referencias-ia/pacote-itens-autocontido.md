# Referência para IA — Pacote Autocontido de Itens do GUM

[English version](./self-contained-item-bundle.md)

> Formato para transportar um Item principal e suas dependências no mesmo JSON.
>
> Implementado no formato `gum-item-bundle`, versão `1`.

## 1. Quando usar

Use este formato quando um equipamento — ou outro Item principal — depender de Itens Efeito, Itens Condição, Modificadores comuns ou Modificadores de Equipamento que ainda não existem no mundo de destino.

O importador:

1. valida todo o pacote antes de gravar;
2. gera IDs estáveis para os documentos que não possuam `_id`;
3. converte referências locais em UUIDs do compêndio escolhido;
4. cria/sincroniza primeiro as dependências;
5. cria/sincroniza o Item principal por último;
6. tenta reverter todas as alterações da operação caso alguma etapa falhe.

Todos os documentos do pacote são importados no mesmo compêndio de Item. Um compêndio criado especificamente para o pacote é a opção mais portátil.

## 2. Estrutura mínima

```json
{
  "format": "gum-item-bundle",
  "version": 1,
  "id": "identificador-estavel-do-pacote",
  "name": "Nome visível do pacote",
  "root": "chave-do-item-principal",
  "documents": {
    "chave-do-item-principal": {
      "name": "Nome do item",
      "type": "equipment",
      "system": {}
    }
  }
}
```

| Campo | Regra |
| --- | --- |
| `format` | Exatamente `gum-item-bundle`. |
| `version` | Atualmente `1`. |
| `id` | Identificador estável e único do pacote. Não o altere em reimportações. |
| `name` | Opcional. Nome da pasta principal; sem ele, usa o nome do Item raiz. |
| `root` | Chave existente dentro de `documents`. |
| `documents` | Objeto não vazio de documentos Foundry Item. |

Cada documento exige `name`, `type` e `system`. A chave em `documents` é o identificador local usado pelas referências. `type` deve ser um tipo de Item reconhecido pelo GUM: `advantage`, `disadvantage`, `skill`, `equipment`, `money_source`, `spell`, `power`, `modifier`, `condition`, `effect`, `trigger`, `eqp_modifier`, `gm_modifier` ou `template`.

### 2.1 Organização automática por tipo

O importador cria uma pasta principal para o pacote e, dentro dela, somente as pastas dos tipos presentes. Por exemplo:

```text
Pacote — Arsenal arcano
├── Equipamentos
├── Vantagens
├── Desvantagens
├── Perícias
├── Poderes
└── Efeitos
```

A regra vale para todos os tipos de Item do GUM, incluindo Magias, Condições, Modificadores, Modificadores de Equipamento, Gatilhos e Modelos. As pastas possuem identidade estável e são reutilizadas em reimportações. Nomes e posições de pastas existentes são preservados, assim como um documento movido manualmente para uma pasta externa ao pacote. Se a pasta externa não existir mais, o documento retorna à pasta administrada pelo pacote.

## 3. IDs, reimportação e segurança

Não é necessário fornecer `_id`. Na ausência dele, o sistema deriva um ID Foundry de 16 caracteres a partir da combinação `bundle.id + chave do documento`. Se `_id` for fornecido, ele deve conter exatamente 16 letras ou algarismos.

Isso significa que:

- importar novamente o mesmo pacote atualiza os mesmos documentos;
- renomear `bundle.id` ou uma chave de `documents` cria outra identidade;
- o nome visível do Item pode mudar sem perder a identidade;
- um ID existente só é atualizado quando possui a marca do mesmo pacote e da mesma chave;
- colisões com documentos não relacionados são recusadas, nunca sobrescritas silenciosamente.

O importador não exclui automaticamente documentos removidos de uma versão posterior do pacote. Pastas de tipo que se tornem vazias também são preservadas, evitando apagar uma pasta que o usuário possa ter personalizado ou reutilizado.

## 4. Referência `effectRef`

Use `effectRef` no lugar de `effectUuid` quando o Item Efeito estiver no mesmo pacote:

```json
{
  "passiveEffects": {
    "protective-aura": {
      "id": "protective-aura",
      "effectRef": "aura-effect",
      "recipient": "self"
    }
  }
}
```

E a definição correspondente:

```json
{
  "aura-effect": {
    "name": "Aura protetora",
    "type": "effect",
    "img": "icons/svg/aura.svg",
    "system": {
      "schemaVersion": 2,
      "actions": []
    }
  }
}
```

Na importação, `effectRef` é removido e substituído por `effectUuid`. `name` e `img` ausentes no vínculo são preenchidos a partir do efeito.

Vários documentos, independentemente de seus tipos, podem usar o mesmo `effectRef`. O Item Efeito é criado uma única vez e todos os vínculos recebem o mesmo UUID. Portanto, uma Vantagem, um Poder, uma Perícia e um Equipamento podem compartilhar a mesma definição sem duplicá-la.

Isso compartilha a **definição**, não necessariamente uma única aplicação no ator. Se um personagem possuir ao mesmo tempo quatro Itens com esse efeito passivo, cada Item poderá originar sua própria instância e os modificadores poderão se acumular. A IA deve decidir conscientemente se esse acúmulo é desejado; caso contrário, use apenas uma fonte ativa ou modele a exclusividade apropriada para a mecânica.

Na versão atual, `conditionStackingMode` controla somente o compartilhamento do mesmo efeito entre Itens Condição. O importador preserva esse campo, mas não transforma essa opção numa regra geral para ativações, efeitos passivos, dano ou equipamento.

O recurso funciona em:

- `activationEffects.success` e `.failure`;
- `onDamageEffects` do Item;
- `onDamageEffects` de ataques;
- `passiveEffects`;
- `useEventEffects`;
- efeitos dentro de `stateEffectGroups`;
- features `granted_effect` de Modificadores de Equipamento.

Em `granted_effect`, o importador produz `effect_uuid`, `effect_name` e `effect_img`, conforme o formato dessa feature.

As referências são aceitas somente nesses locais mecânicos. Não coloque `effectRef` em campos descritivos ou objetos arbitrários.

## 5. Referência `conditionRef`

Use para Itens Condição locais:

```json
{
  "generalConditions": {
    "linked-condition": {
      "id": "linked-condition",
      "conditionRef": "condition-document"
    }
  }
}
```

O destino precisa ter `type: "condition"`. Na importação, `conditionRef` se torna `uuid`; nome e imagem auxiliares são preenchidos quando ausentes.

Use-a somente em `system.generalConditions`, inclusive na coleção correspondente de um ataque.

## 6. Referência `modifierRef`

Dentro de `system.eqp_modifiers`, `modifierRef` anexa um snapshot completo do Item Modificador:

```json
{
  "eqp_modifiers": {
    "fine-instance": {
      "id": "fine-instance",
      "modifierRef": "fine-modifier",
      "enabled": true,
      "level": 2
    }
  }
}
```

O documento referenciado precisa ter `type: "eqp_modifier"`. O importador copia ajustes de custo/peso, features, grupo, TL e referência, registra `source_uuid` e aplica os valores locais de `enabled` e `level`.

Se esse modificador possuir uma feature `granted_effect`, ela pode usar `effectRef` normalmente.

### 6.1 Referência `traitModifierRef`

Dentro de `system.modifiers` de uma Vantagem, Desvantagem ou Poder, `traitModifierRef` anexa o snapshot de um Item Modificador comum (`type: "modifier"`):

```json
{
  "modifiers": {
    "area-ampliada": {
      "traitModifierRef": "ampliacao-area-ampliada",
      "level": 1
    }
  }
}
```

O importador copia custo, nível, escopo, controles de nível, descrição e demais dados persistidos pelo vínculo normal, registra o UUID em `source_id` e permite sobrescrever localmente campos como `level`. Isso serve tanto para ampliações com custo positivo quanto para limitações com custo negativo.

## 7. Exemplo completo

Além do exemplo abaixo, o arquivo [pacote com vários tipos de Item e efeitos compartilhados](./exemplos/pacote-dois-equipamentos-com-efeitos.json) pode ser importado diretamente. Ele contém Equipamentos, Vantagem, Desvantagem, Poder e Perícia, demonstrando vários documentos apontando para o mesmo Item Efeito.

```json
{
  "format": "gum-item-bundle",
  "version": 1,
  "id": "flaming-longsword-v1",
  "root": "flaming-sword",
  "documents": {
    "burning-effect": {
      "name": "Em chamas",
      "type": "effect",
      "img": "icons/magic/fire/flame-burning-creature-skeleton.webp",
      "system": {
        "description": "<p>O alvo está em chamas.</p>",
        "chat_description": "",
        "ref": "",
        "schemaVersion": 2,
        "conditionStackingMode": "stack",
        "tokenIconPolicy": "auto",
        "duration": {
          "value": 3,
          "unit": "rounds",
          "inCombat": true,
          "isPermanent": false,
          "startMode": "apply",
          "endMode": "turnEnd"
        },
        "resistanceRoll": {
          "isResisted": false,
          "attribute": "ht",
          "modifier": "0",
          "applyOn": "failure",
          "margin": "",
          "mode": "simple",
          "branches": [],
          "chatText": "",
          "skipPromptCard": false,
          "chatVisibility": "owners",
          "requestedPurposeIds": []
        },
        "actions": [
          {
            "id": "burn-message",
            "label": "Mensagem",
            "type": "chat",
            "message": "<p>O alvo foi incendiado.</p>"
          }
        ]
      }
    },
    "fine-modifier": {
      "name": "Qualidade Superior",
      "type": "eqp_modifier",
      "img": "icons/skills/trades/smithing-anvil-silver-red.webp",
      "system": {
        "description": "<p>Construção superior.</p>",
        "chat_description": "",
        "ref": "",
        "group": "Qualidade",
        "tech_level": "",
        "enabled": true,
        "level": 1,
        "points": 0,
        "adjustment_schema": 1,
        "cost_adjustment": "+3 CF",
        "cost_factor": 3,
        "weight_mod": "x1",
        "cost_adjustment_data": {
          "expression": "+3 CF",
          "stage": "base",
          "per_level": false,
          "per_weight": false,
          "per_weight_unit": "kg"
        },
        "weight_adjustment_data": {
          "expression": "x1",
          "stage": "base",
          "per_level": false
        },
        "features_data": {
          "quality": {
            "id": "quality",
            "label": "Qualidade",
            "type": "equipment_property",
            "enabled": true,
            "path": "quality",
            "operation": "add",
            "value": "Superior",
            "per_level": false
          }
        },
        "gcs_features_unmapped": [],
        "scenario": {
          "rarity": "",
          "location": "",
          "availability": "",
          "components": ""
        }
      }
    },
    "flaming-sword": {
      "name": "Espada Longa Flamejante",
      "type": "equipment",
      "img": "icons/weapons/swords/sword-flanged-lightning.webp",
      "system": {
        "description": "<p>Uma espada de qualidade que incendeia seus alvos.</p>",
        "chat_description": "",
        "favorite_in_combat": true,
        "ref": "",
        "quantity": 1,
        "level": "",
        "points": 0,
        "cost": 700,
        "weight": 1.5,
        "location": "carried",
        "melee_attacks": {
          "flaming-slash": {
            "id": "flaming-slash",
            "mode": "Golpe flamejante",
            "skill_name": "Espadas de Lâmina Larga",
            "skill_level_mod": 0,
            "damage_formula": "GdB+1",
            "damage_type": "cort",
            "damage_nature": "",
            "damage_scaling": "",
            "armor_divisor": 1,
            "reach": "1",
            "parry": "0",
            "block": "",
            "parry_default": true,
            "block_default": true,
            "min_strength": 10,
            "groups": "espada, flamejante",
            "unbalanced": false,
            "fencing": false,
            "follow_up_damage": {
              "formula": "1d",
              "type": "qmd",
              "nature": "",
              "scaling": "",
              "armor_divisor": 1
            },
            "fragmentation_damage": {
              "formula": "",
              "type": "",
              "nature": "",
              "scaling": "",
              "armor_divisor": 1
            },
            "onDamageEffects": {
              "burning": {
                "id": "burning",
                "effectRef": "burning-effect",
                "minInjury": 1,
                "requiredDamageType": "",
                "activationChance": 100
              }
            }
          }
        },
        "ranged_attacks": {},
        "eqp_modifiers": {
          "fine": {
            "id": "fine",
            "modifierRef": "fine-modifier",
            "enabled": true,
            "level": 1
          }
        },
        "activationEffects": {
          "success": {},
          "failure": {}
        },
        "onDamageEffects": {},
        "generalConditions": {},
        "passiveEffects": {},
        "useEventEffects": {},
        "stateEffectGroups": {}
      }
    }
  }
}
```

Campos de equipamento não relevantes ao exemplo podem ser completados pelos padrões do modelo do sistema.

## 8. Como importar

1. Abra a opção de importar biblioteca JSON do GUM.
2. Selecione o arquivo `.json` com `format: "gum-item-bundle"`.
3. Escolha um compêndio de Item existente ou crie um novo.
4. Confira a prévia: documentos novos, atualizações e possíveis colisões.
5. Importe.

Efeitos e condições permanecem no compêndio e são acessados por UUID. Modificadores também são criados como documentos, mas o equipamento recebe um snapshot mecânico completo.

## 9. Limitações deliberadas

- O pacote contém documentos do tipo Item; não cria Actor, Macro, Journal ou RollTable.
- `parent_container_id` continua dependente de IDs de itens incorporados num ator.
- `ammunition_ids` também depende dos IDs que as munições recebem ao serem adicionadas ao ator; o pacote não tenta criar esse vínculo antecipadamente.
- Somente `effectRef`, `conditionRef`, `modifierRef` e `traitModifierRef` são resolvidos. Strings arbitrárias não recebem interpolação.
- Cada objeto de vínculo aceita exatamente um desses quatro campos de referência, no local mecânico documentado para ele.
- Referências externas por UUID continuam aceitas normalmente e não precisam estar no pacote.
- Remover uma chave de uma versão futura do pacote não apaga automaticamente o documento antigo.

## 10. Checklist para uma IA

- [ ] `format`, `version`, `id`, `root` e `documents` estão presentes.
- [ ] `id` do pacote e chaves dos documentos permanecem estáveis entre versões.
- [ ] `root` corresponde exatamente a uma chave existente.
- [ ] Cada documento possui `name`, `type` e `system`.
- [ ] Cada `effectRef` aponta para um documento `effect`.
- [ ] Cada `conditionRef` aponta para um documento `condition`.
- [ ] Cada `modifierRef` aponta para um documento `eqp_modifier`.
- [ ] Cada `traitModifierRef` aponta para um documento `modifier`.
- [ ] Nenhum objeto mistura dois campos `*Ref` ou usa uma referência fora da coleção apropriada.
- [ ] Referências dependentes do ator ficaram vazias.
- [ ] O JSON é válido e não contém comentários.
