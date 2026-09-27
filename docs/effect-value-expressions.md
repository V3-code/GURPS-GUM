# Expressões de valor dos Itens Efeito

Os campos numéricos de um **Item Efeito** aceitam valores fixos, fórmulas de dados e expressões condicionais. Este guia descreve a sintaxe disponível, o momento em que cada valor é avaliado e exemplos de composição.

## Exemplo rápido

```text
se(possui("Treinado por um Mestre"), -2, -4)
```

O primeiro valor (`-2`) é usado quando o ator possui o item indicado. Caso contrário, o segundo valor (`-4`) é usado.

## Estrutura básica

```text
se(CONDIÇÃO, VALOR_SE_VERDADEIRO, VALOR_SE_FALSO)
```

Os valores de resultado podem ser números, fórmulas ou outra expressão `se(...)`:

```text
se(possui("Resistência ao Fogo"), 1d6, 2d6)
```

```text
se(possui("A"), 2, se(possui("B"), 1, 0))
```

Somente o ramo escolhido é encaminhado ao avaliador de fórmula ou rolagem.

Em modificadores de rolagem, um ramo com dados — por exemplo `1d6` — é rolado quando o modificador é preparado para aquela rolagem. O total obtido é usado como modificador.

## Consultas de itens

| Expressão | Resultado |
| --- | --- |
| `possui("A")` | Verdadeiro quando existe um item correspondente. |
| `naopossui("A")` | Verdadeiro quando o item não existe. `nãopossui` também é aceito. |
| `possuiAlgum("A", "B")` | Verdadeiro quando pelo menos um dos itens existe. |
| `possuiTodos("A", "B")` | Verdadeiro quando todos os itens existem. |
| `equipado("A")` | Verdadeiro quando pelo menos uma cópia correspondente está equipada. |
| `nivel("A")` | Retorna o nível do item ou `0` quando ele não existe/não possui nível. |
| `quantidade("A")` | Retorna a quantidade do item ou `0` quando ele não existe. |

Uma referência pode ser o nome, ID, UUID ou `sourceId` do item. Nomes ignoram diferenças entre maiúsculas, minúsculas e acentuação. Quando nomes duplicados existirem, `equipado()` será verdadeiro se **qualquer** cópia estiver equipada. Para apontar uma cópia específica, use seu ID ou UUID.

## Estado do ator

| Expressão | Resultado |
| --- | --- |
| `atributo("DX")` | Retorna o valor preparado do atributo. |
| `condicaoAtiva("Concentrado")` | Verifica se o Item Condição está ativo e não foi desabilitado manualmente. |
| `status("stunned")` | Verifica um status aplicado pelo ID ou pelo nome do efeito ativo. |

`status()` considera também efeitos transferidos por itens, desde que estejam aplicados e não estejam desabilitados ou suprimidos.

## Comparações

As consultas numéricas podem usar os operadores abaixo:

| Operador | Significado |
| --- | --- |
| `=` ou `==` | Igual |
| `!=` | Diferente |
| `>` | Maior |
| `>=` | Maior ou igual |
| `<` | Menor |
| `<=` | Menor ou igual |

Exemplos:

```text
se(nivel("Talento Marcial") >= 2, 2, 1)
```

```text
se(quantidade("Flecha") > 0, 0, -4)
```

```text
se(atributo("DX") = 14, 2, 0)
```

## Operadores lógicos

| Expressão | Resultado |
| --- | --- |
| `todos(C1, C2, ...)` | Verdadeiro quando todas as condições são verdadeiras. |
| `algum(C1, C2, ...)` | Verdadeiro quando ao menos uma condição é verdadeira. |
| `nao(C)` ou `não(C)` | Inverte uma condição. |

Os operadores podem ser aninhados livremente:

```text
se(
  todos(
    equipado("Espada"),
    possuiAlgum("Treinado por um Mestre", "Mestre de Armas"),
    nao(status("stunned"))
  ),
  -2,
  -4
)
```

`algum()` e `todos()` recebem condições completas. Portanto, use:

```text
algum(possui("A"), possui("B"))
```

e não `algum("A", "B")`. Para a forma abreviada baseada apenas em itens, use `possuiAlgum("A", "B")`.

## Fórmulas com vírgulas

Vírgulas dentro de parênteses, colchetes, chaves ou texto entre aspas são preservadas. Assim, termos agrupados do Foundry continuam válidos:

```text
se(possui("Sorte"), {1d6,2d6}kh, {1d6,2d6}kl)
```

## Momento da avaliação

| Tipo da ação | Momento |
| --- | --- |
| Modificador de atributo | Quando o efeito é aplicado. |
| Override de dano básico | A condição é resolvida ao aplicar; a fórmula escolhida é preservada para a futura rolagem de dano. |
| Modificador de rolagem | A cada rolagem compatível. |
| Alteração de recurso | Quando a alteração é executada. Fórmulas comuns usam uma única rolagem para todos os alvos; condicionais são resolvidas para cada alvo. |
| Criação de recurso | Quando o recurso é criado ou atualizado. |

No modo **Por nível do item de origem**, o sistema primeiro escolhe o ramo condicional e depois multiplica o valor resultante pelo nível.

Entradas configuradas para serem incorporadas permanentemente ao NH devem ser determinísticas. Fórmulas de dados são ignoradas nesse modo para impedir que a simples preparação ou reabertura da ficha altere o NH. Use dados somente em modificadores avaliados no momento da rolagem.

## Boas práticas

- Prefira nomes claros quando a mesa controla os nomes dos itens.
- Use ID ou UUID quando houver itens homônimos e for necessário apontar uma cópia específica.
- Use `possuiAlgum()` e `possuiTodos()` para listas simples de itens; reserve `algum()` e `todos()` para combinar condições diferentes.
- Mantenha no Item Condição a regra que decide **quando** disparar. Use a expressão do Item Efeito para decidir **qual valor** aplicar.
- Teste a expressão com um ator que possua o item e outro que não possua.

Quando uma expressão condicional for inválida, o sistema registra um aviso no console e usa valor neutro (`0`) para evitar uma aplicação incorreta.
