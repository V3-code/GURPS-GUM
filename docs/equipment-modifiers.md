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

`features_data` agora aceita quatro tipos:

- `equipment_property` — soma, multiplica ou define uma propriedade permitida do equipamento;
- `attack_property` — altera ataques corpo a corpo, à distância ou ambos, filtrados por grupo, modo ou perícia;
- `create_attack` — cria um modo de ataque derivado com ID estável, sem gravá-lo sobre o equipamento-base.
- `granted_effect` — vincula uma capacidade do equipamento a um item Efeito reutilizável.

Criações são resolvidas antes das alterações. Substituições, multiplicações e somas possuem uma ordem determinística, e substituições concorrentes produzem avisos. Features por nível usam o nível da instância do modificador.

## Etapa implementada: efeitos concedidos ao portador

O tipo `granted_effect` vincula um item Efeito por UUID e registra seu domínio e ciclo de vida. Efeitos no domínio `wearer` são sincronizados de forma idempotente com o ator e podem permanecer ativos enquanto o equipamento estiver possuído, carregado, equipado ou ativado. Somente ações persistentes são aplicadas nessa sincronização; alterações instantâneas de recursos não são repetidas.

O domínio `source_attack` instala somente ações compatíveis de rolagem/perícia/combate e as limita ao item hospedeiro e aos ataques correspondentes ao seletor. O domínio `hit_target` transforma o vínculo em um efeito de dano no modo de ataque correspondente, reutilizando as regras existentes de ferimento mínimo, chance de ativação e tipo de dano.

## Etapa implementada: efeitos de ataque e de impacto

Os três domínios estão integrados:

- `wearer` — efeito persistente no portador conforme o ciclo de vida;
- `source_attack` — modificadores de rolagem e combate limitados aos ataques do equipamento;
- `hit_target` — efeito encaminhado ao pipeline de dano e aplicado ao alvo quando suas condições forem satisfeitas.

## Próxima etapa

Aprimorar a autoria e a apresentação: navegador de itens Efeito no lugar do UUID manual, visualização da fonte vinculada, memória detalhada das features aplicadas e editores especializados para propriedades complexas.
