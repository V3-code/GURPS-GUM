# Modificadores de equipamento

## Etapa implementada: preço e peso centralizados

O cálculo canônico está em `module/utils/equipment-resolution.mjs`. Fichas de item e preparação do ator devem consumir `resolveEquipment()`; não devem reinterpretar as expressões localmente.

Cada modificador possui um ajuste de preço, um ajuste de peso e uma coleção reservada para features estruturadas. Um equipamento pode combinar qualquer quantidade de modificadores.

### Etapas

Os ajustes são agrupados, independentemente da ordem visual dos modificadores, nesta sequência:

1. `original` — valor ou peso original;
2. `base` — custo/peso-base;
3. `final_base` — valor ou peso-base final;
4. `final` — valor ou peso final.

No custo-base, CFs são somados. Um multiplicador `xN` equivale a `+(N - 1) CF` nessa etapa. O CF total possui limite inferior de `-0,8`, preservando pelo menos 20% do subtotal que entra na etapa.

Nas demais etapas de custo, adições e percentuais são agregados e os multiplicadores são aplicados ao subtotal de entrada. No peso original são aceitos adições e percentuais; nas outras etapas são aceitos adições e multiplicadores.

### Escalonamento

- **Por nível:** multiplica o valor do ajuste pelo nível da instância aplicada. Nível zero não contribui.
- **Por peso:** existe somente para custo e usa o peso unitário final já resolvido. A unidade pode ser kg ou lb.
- **Quantidade:** é aplicada somente depois dos valores unitários finais.

### Compatibilidade

Os campos legados `cost_adjustment`, `cost_factor` e `weight_mod` continuam sendo lidos. Ao salvar a nova ficha, `adjustment_schema: 1` identifica que os dados estruturados são a fonte canônica e as expressões legadas são sincronizadas para consumidores antigos.

## Etapa implementada: features estruturadas

`features_data` agora aceita três tipos iniciais:

- `equipment_property` — soma, multiplica ou define uma propriedade permitida do equipamento;
- `attack_property` — altera ataques corpo a corpo, à distância ou ambos, filtrados por grupo, modo ou perícia;
- `create_attack` — cria um modo de ataque derivado com ID estável, sem gravá-lo sobre o equipamento-base.

Criações são resolvidas antes das alterações. Substituições, multiplicações e somas possuem uma ordem determinística, e substituições concorrentes produzem avisos. Features por nível usam o nível da instância do modificador.

## Próxima etapa

Adicionar features concedidas com domínio e ciclo de vida explícitos: efeitos sobre o portador, sobre rolagens originadas no equipamento e sobre alvos atingidos. Também será possível ampliar os filtros e fornecer editores especializados para propriedades complexas.
