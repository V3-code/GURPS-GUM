# AI Reference — GUM Self-Contained Item Bundle

[Versão em português](./pacote-itens-autocontido.md)

> Format for transporting a root Item and its dependencies in one JSON file.
>
> Implemented as `gum-item-bundle`, version `1`.

## 1. Purpose

Use this format when equipment—or another root Item—depends on Effect Items, Condition Items, regular Modifiers, or Equipment Modifiers that do not yet exist in the destination world.

The importer validates the complete bundle, assigns stable IDs, converts local references into UUIDs in the chosen compendium, synchronizes dependencies before the root Item, and attempts to roll back the operation if any write fails.

All bundle documents are imported into the same Item compendium. A dedicated compendium is the most portable choice.

## 2. Minimum structure

```json
{
  "format": "gum-item-bundle",
  "version": 1,
  "id": "stable-bundle-identifier",
  "name": "Visible bundle name",
  "root": "root-item-key",
  "documents": {
    "root-item-key": {
      "name": "Item name",
      "type": "equipment",
      "system": {}
    }
  }
}
```

| Field | Rule |
| --- | --- |
| `format` | Exactly `gum-item-bundle`. |
| `version` | Currently `1`. |
| `id` | Stable unique bundle identifier. Do not change it on reimport. |
| `name` | Optional. Main folder name; defaults to the root Item name. |
| `root` | An existing key in `documents`. |
| `documents` | A non-empty keyed object of Foundry Item documents. |

Each document requires `name`, `type`, and `system`. Its key is the local identifier used by references. `type` must be a recognized GUM Item type: `advantage`, `disadvantage`, `skill`, `equipment`, `money_source`, `spell`, `power`, `modifier`, `condition`, `effect`, `trigger`, `eqp_modifier`, `gm_modifier`, or `template`.

### 2.1 Automatic organization by type

The importer creates one folder for the bundle and only the required type folders below it:

```text
Bundle — Arcane arsenal
├── Equipment
├── Advantages
├── Disadvantages
├── Skills
├── Powers
└── Effects
```

This applies to every GUM Item type, including Spells, Conditions, Modifiers, Equipment Modifiers, Triggers, and Templates. Folder identities are stable across reimports. Existing folder names and locations are preserved, as is a document manually moved outside the bundle. If that external folder no longer exists, the document returns to its bundle-managed type folder.

## 3. Identity and safe reimport

`_id` is optional. When absent, the system derives a stable 16-character Foundry ID from `bundle.id + document key`. If supplied, `_id` must contain exactly 16 letters or digits.

Reimporting the same bundle therefore updates the same documents. Changing the bundle ID or a document key changes identity; changing only the visible Item name does not. An existing ID is updated only when it carries the same bundle-and-key marker. A collision with an unrelated document is refused rather than silently overwritten.

Removing a document from a later bundle version does not automatically delete the previously imported document. Empty type folders are also preserved so a customized or repurposed folder is never deleted implicitly.

## 4. Local references

### `effectRef`

Use it instead of `effectUuid`:

```json
{
  "passiveEffects": {
    "aura": {
      "id": "aura",
      "effectRef": "aura-effect",
      "recipient": "self"
    }
  }
}
```

The target must be a document with `type: "effect"`. The importer replaces `effectRef` with its destination `effectUuid` and fills missing link name/image metadata. It works in activation, on-damage, passive, use-event, state-group, and attack effect collections.

Any number of documents, regardless of Item type, may use the same `effectRef`. The Effect Item is created once and every link receives the same UUID, allowing Equipment, Advantages, Disadvantages, Skills, Powers, Spells, and other Items to share one definition without duplication.

This shares the **definition**, not necessarily one runtime application on an Actor. If a character owns four Items with the same passive effect, each Item may create its own Active Effect and their modifiers may stack. An AI must decide whether that stacking is intentional; otherwise, keep only one source active or model exclusivity appropriate to the mechanic.

In the current version, `conditionStackingMode` controls sharing only when the same Effect is linked by Condition Items. The importer preserves the field but does not turn it into a general stacking policy for activation, passive, damage, or equipment applications.

Inside an Equipment Modifier `granted_effect` feature, the importer writes `effect_uuid`, `effect_name`, and `effect_img` instead.

References are accepted only in these mechanical locations. Do not place `effectRef` in descriptive or arbitrary objects.

### `conditionRef`

```json
{
  "generalConditions": {
    "condition": {
      "id": "condition",
      "conditionRef": "condition-document"
    }
  }
}
```

The target must have `type: "condition"`. The importer writes `uuid` and fills missing name/image metadata.

Use it only in `system.generalConditions`, including the corresponding collection on an attack.

### `modifierRef`

Use it in `system.eqp_modifiers`:

```json
{
  "eqp_modifiers": {
    "fine": {
      "id": "fine",
      "modifierRef": "fine-modifier",
      "enabled": true,
      "level": 2
    }
  }
}
```

The target must have `type: "eqp_modifier"`. The importer embeds a complete mechanical snapshot, records `source_uuid`, and applies local `enabled` and `level` overrides. A `granted_effect` within that modifier may itself use `effectRef`.

### `traitModifierRef`

Use it inside `system.modifiers` on an Advantage, Disadvantage, or Power:

```json
{
  "modifiers": {
    "increased-area": {
      "traitModifierRef": "increased-area-enhancement",
      "level": 1
    }
  }
}
```

The target must have `type: "modifier"`. The importer copies the standard attached-modifier snapshot, records its UUID in `source_id`, and permits local overrides such as `level`. Both positive-cost enhancements and negative-cost limitations use this mechanism.

## 5. Complete compact example

The directly importable [multi-type shared-effect bundle](./exemplos/pacote-dois-equipamentos-com-efeitos.json) includes Equipment, an Advantage, a Disadvantage, a Power, and a Skill, with several documents sharing the same Effect Item.

```json
{
  "format": "gum-item-bundle",
  "version": 1,
  "id": "flaming-sword-v1",
  "root": "flaming-sword",
  "documents": {
    "burning-effect": {
      "name": "Burning",
      "type": "effect",
      "img": "icons/svg/fire.svg",
      "system": {
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
        "actions": []
      }
    },
    "fine-modifier": {
      "name": "Fine Quality",
      "type": "eqp_modifier",
      "system": {
        "enabled": true,
        "level": 1,
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
        "features_data": {},
        "gcs_features_unmapped": []
      }
    },
    "flaming-sword": {
      "name": "Flaming Sword",
      "type": "equipment",
      "system": {
        "description": "<p>A fine sword that sets its targets on fire.</p>",
        "quantity": 1,
        "cost": 700,
        "weight": 1.5,
        "location": "carried",
        "melee_attacks": {
          "slash": {
            "id": "slash",
            "mode": "Flaming swing",
            "skill_name": "Broadsword",
            "skill_level_mod": 0,
            "damage_formula": "sw+1",
            "damage_type": "cut",
            "armor_divisor": 1,
            "reach": "1",
            "parry": "0",
            "block": "",
            "parry_default": true,
            "block_default": true,
            "min_strength": 10,
            "groups": "sword, flaming",
            "unbalanced": false,
            "fencing": false,
            "follow_up_damage": {
              "formula": "1d",
              "type": "burn",
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
        }
      }
    }
  }
}
```

System model defaults may fill equipment fields not relevant to the example.

## 6. Import workflow

1. Open GUM's JSON library import.
2. Select a `.json` file with `format: "gum-item-bundle"`.
3. Choose an existing Item compendium or create a new one.
4. Review creates, updates, and collisions.
5. Import.

Effects and Conditions remain compendium documents addressed by UUID. Equipment Modifiers are also created as documents, while the root equipment receives a complete mechanical snapshot.

## 7. Deliberate limitations

- A bundle contains Item documents only; it does not create Actors, Macros, Journals, or RollTables.
- `parent_container_id` and `ammunition_ids` remain actor-embedded ID relationships and are not prelinked by the bundle.
- Only `effectRef`, `conditionRef`, `modifierRef`, and `traitModifierRef` are resolved; arbitrary strings are not interpolated.
- Each link object accepts exactly one of those four reference fields in its documented mechanical location.
- External UUID references remain valid and need not be included in the bundle.
- Removing a key from a later bundle does not delete the older imported document.

## 8. AI checklist

- [ ] `format`, `version`, `id`, `root`, and `documents` are present.
- [ ] Bundle ID and document keys remain stable across versions.
- [ ] `root` exactly matches an existing document key.
- [ ] Every document has `name`, `type`, and `system`.
- [ ] Every `effectRef` targets an `effect` document.
- [ ] Every `conditionRef` targets a `condition` document.
- [ ] Every `modifierRef` targets an `eqp_modifier` document.
- [ ] Every `traitModifierRef` targets a `modifier` document.
- [ ] No object mixes two `*Ref` fields or places a reference outside its supported collection.
- [ ] Actor-dependent references remain empty.
- [ ] JSON is valid and contains no comments.
