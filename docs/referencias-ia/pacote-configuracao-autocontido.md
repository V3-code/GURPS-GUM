# Referência para IA — Pacote Autocontido de Configuração do GUM

[English version](./self-contained-configuration-bundle.md)

> Formato usado para transportar uma configuração do Escudo do Mestre ou dos status mundiais junto de seus Itens dependentes.
>
> Implementado como `gum-configuration-bundle`, versão `1`.

## Estrutura

```json
{
  "format": "gum-configuration-bundle",
  "version": 1,
  "id": "identificador-estavel",
  "name": "Nome visível",
  "kind": "gm-screen",
  "configuration": {},
  "documents": {},
  "portability": {
    "complete": true,
    "unresolvedReferences": [],
    "unsupportedReferences": [],
    "externalAssets": [],
    "systemVersion": "1.4.4-beta",
    "foundryVersion": "13"
  }
}
```

`kind` aceita `gm-screen` ou `world-statuses`. `id` deve permanecer estável em reimportações. Os documentos são sincronizados em um compêndio de Item antes da configuração ser aplicada. IDs, pastas e rollback seguem as mesmas garantias do [pacote autocontido de Itens](./pacote-itens-autocontido.md).

`portability` é gerado pelo exportador. Ele registra referências que não puderam ser incorporadas, tipos incompatíveis, caminhos externos de imagens e as versões de origem. Uma IA pode omitir esse objeto ao criar um arquivo manualmente; ele é diagnóstico, não parte da configuração.

## Escudo do Mestre

Em `kind: "gm-screen"`, cada entrada de `group.items` pode conter um UUID externo ou uma referência local:

```json
{
  "items": [
    { "itemRef": "nevoa" },
    { "itemRef": "penalidade-escuridao" }
  ]
}
```

O destino de `itemRef` deve ser um Item `effect` ou `gm_modifier` presente em `documents`. Um `gm_modifier` também pode usar `effectRef` nos vínculos mecânicos normais de Item, como `passiveEffects` e `activationEffects`. A exportação inclui automaticamente esses efeitos indiretos.

## Status mundiais

Em `kind: "world-statuses"`, referências locais aparecem em `effectUuids`:

```json
{
  "overrides": {
    "stunned": {
      "effectUuids": [
        { "effectRef": "efeito-atordoado" }
      ]
    }
  }
}
```

Também é aceita a forma auxiliar `effectRefs: ["efeito-atordoado"]`. O destino deve ser um Item `effect` presente em `documents`. Vários status podem apontar para a mesma chave, criando o Item Efeito apenas uma vez.

## Compatibilidade e comportamento

- Os exportadores do Escudo do Mestre e dos status geram este formato automaticamente.
- JSONs antigos, contendo apenas a configuração, continuam aceitos.
- UUIDs externos sem documento correspondente são preservados; isso permite referências deliberadas a conteúdo já instalado, mas elas continuarão dependentes do mundo de destino.
- A importação apresenta uma prévia antes de gravar e oferece três modos: `Somente acrescentar`, `Mesclar e atualizar` e `Substituir tudo`.
- `Somente acrescentar` preserva opções existentes e reúne novos grupos, vínculos e status. Ele não desativa status que já estão disponíveis no mundo.
- `Mesclar e atualizar` é o padrão: dados importados atualizam entradas de mesmo ID, vínculos são reunidos sem duplicação e entradas exclusivamente locais permanecem.
- `Substituir tudo` usa a configuração importada como fonte completa e remove dela grupos, alterações e status personalizados locais ausentes. Efeitos já aplicados a atores não são apagados.
- Falhas na configuração revertem Itens e pastas criados ou atualizados durante a operação.
- Imagens continuam sendo caminhos Foundry; os arquivos de imagem não são incorporados ao JSON.

