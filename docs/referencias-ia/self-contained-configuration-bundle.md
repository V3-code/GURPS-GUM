# AI Reference — GUM Self-Contained Configuration Bundle

[Versão em português](./pacote-configuracao-autocontido.md)

> Format for transporting a GM Screen or world-status configuration together with its dependent Items.
>
> Implemented as `gum-configuration-bundle`, version `1`.

## Structure

```json
{
  "format": "gum-configuration-bundle",
  "version": 1,
  "id": "stable-identifier",
  "name": "Display name",
  "kind": "gm-screen",
  "configuration": {},
  "documents": {}
}
```

`kind` accepts `gm-screen` or `world-statuses`. Keep `id` stable across reimports. Documents are synchronized into an Item compendium before the configuration is replaced. IDs, folders, and rollback use the same guarantees as the [self-contained Item bundle](./self-contained-item-bundle.md).

## GM Screen

With `kind: "gm-screen"`, each `group.items` entry may be an external UUID or a local reference:

```json
{
  "items": [
    { "itemRef": "fog" },
    { "itemRef": "darkness-penalty" }
  ]
}
```

`itemRef` must target an `effect` or `gm_modifier` Item in `documents`. A `gm_modifier` may also use `effectRef` in regular Item effect links such as `passiveEffects` and `activationEffects`. Exports automatically include these indirect effects.

## World statuses

With `kind: "world-statuses"`, local references appear in `effectUuids`:

```json
{
  "overrides": {
    "stunned": {
      "effectUuids": [
        { "effectRef": "stunned-effect" }
      ]
    }
  }
}
```

The auxiliary form `effectRefs: ["stunned-effect"]` is also accepted. Each target must be an `effect` Item in `documents`. Multiple statuses may share one key, creating the Effect Item only once.

## Compatibility and behavior

- The GM Screen and world-status exporters generate this format automatically.
- Legacy JSON files containing only configuration data remain supported.
- External UUIDs without an embedded document are preserved. They remain dependent on content already installed in the destination world.
- Import replaces the current configuration after synchronizing every document.
- A configuration failure rolls back Items and folders created or updated by the operation.
- Images remain Foundry paths; image files are not embedded in the JSON.

