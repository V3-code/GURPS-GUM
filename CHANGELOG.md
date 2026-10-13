# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue uma adaptação de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e usa [SemVer](https://semver.org/lang/pt-BR/).

## [1.4.3-beta] - 2026-10-13

### Added

- Ocupação tática de hexes do GURPS, opcional por configuração mundial: identifica tokens visíveis no mesmo hex e elevação, inclusive tokens de múltiplos hexes, com marcador no canvas e painel persistente para controlar, marcar como alvo, abrir a ficha ou configurar cada ocupante.
- Registro vinculado de integridade para equipamentos: PV máximo, PV atual e RD próprios, independente de cargas e disponível na aba Combate e na aplicação de dano.
- Caminho `all`/`todos` para modificadores de RD, aplicável a todas as localizações de proteção do personagem.

### Changed

- Tabela de RD, janela de dano e importação do GCS agora normalizam todos os perfis corporais, removendo localizações remanescentes e exibindo braços e pernas agrupados apenas quando seus valores de RD forem iguais.
- Itens Efeito, seus navegadores de contexto e finalidade, o card de entrada do comando `/gum` e partes complementares do Escudo do Mestre receberam internacionalização em português e inglês.
- A coluna de cards de personagens do Escudo do Mestre recebeu largura fixa um pouco maior, preservando o layout de duas colunas.

### Fixed

- Alternância de perfil corporal, especialmente após importação do GCS, volta corretamente ao conjunto de localizações humanoide padrão sem duplicar pernas, pés ou outras entradas.
- Aplicação de dano prioriza o token marcado como alvo e usa o token selecionado apenas quando não houver alvo.
- Efeitos com múltiplas ações de modificador de rolagem agora são todos considerados nas defesas ativas pelo Escudo do Mestre; o BD de equipamento não é duplicado.
- Cards de chat do GUM usam o hook moderno de renderização do Foundry V13+, removendo o aviso de API depreciada.

## [1.4.2-beta] - 2026-10-12

### Added

- API pública JavaScript `game.gum.api` v1, organizada por domínio, com resolução de documentos, erros estáveis, permissões, compatibilidade com macros antigas, documentação em português e inglês e declarações TypeScript.
- Fluxo nativo de consumo em magias e poderes, com fontes alternativas, confirmação de quantidade, custos por tentativa, sucesso ou falha e suporte a PV, PF, itens, reservas e registros de combate.
- Controles de `+` e `−` na confirmação de consumo e expressões de valor para o Modificador do Mestre.
- Solicitações de teste e barreiras de resistência agora oferecem rerrolagem diretamente no card de chat.

### Changed

- Fichas de magia e poder, consumo de recursos, mensagens de efeito e cartões de teste foram reorganizados e internacionalizados em português e inglês.
- Escudo do Mestre passou a ter um layout responsivo, com coluna de personagens fixa, solicitação de teste dedicada e controles rápidos compactos no rodapé da área principal.
- Seletor de status dos efeitos agora pesquisa os status configurados pelo mundo e privilegia o nome visível em vez do identificador interno.
- Entradas de Modificador do Mestre agora preservam valores como expressões e aceitam fórmulas de dados, JavaScript e a linguagem condicional compartilhada com Itens Efeito.
- Cards de resultado de testes e dano, além da janela de aplicação de dano, agora exibem seus controles e resultados em português ou inglês; a busca de localizações de proteção aceita nomes nos dois idiomas.

### Removed

- Compêndios inerentes do sistema; mesas passam a usar apenas compêndios criados e configurados pelo próprio usuário, preservados nas atualizações.

### Fixed

- Reimportações do GCS agora reconciliam os modos de ataque existentes, sem duplicá-los ao atualizar uma ficha.
- Alternativas de consumo, cartões de favoritos com efeitos de uso, solicitações de teste e cards de resistência receberam correções de contraste, alinhamento e comportamento.
- A rolagem de dano básico pela barra lateral agora inclui os danos secundários configurados; o dano de acompanhamento mantém sua aplicação independente.

## [1.4.1-beta] - 2026-10-10

### Added

- Configuração mundial de status do token, com ordenação refletida no HUD, edição de nome e ícone, vínculos de efeitos, revisão de referências, restauração dos padrões e importação ou exportação em JSON.
- Arrastar e soltar Itens Efeito e Modificadores em fichas de itens, com permissão configurável por nível de usuário.
- Contagem opcional de acertos por tiro rápido conforme margem de sucesso, Rcl e munição disparada, integrada aos cards de ataque e dano.
- Distribuição de pagamentos de modelos entre múltiplas fontes monetárias do personagem.

### Changed

- Aplicação de modelos por dinheiro passou a separar os modos de gasto, aceitar limite vazio como ilimitado e apresentar totais monetários coerentes em todas as etapas.
- Entradas de equipamento em modelos agora separam nível e valor em pontos, podem bloquear alterações de quantidade e preservam escolhas garantidas importadas do GCS.
- Arrastar um Item Modelo para uma ficha de personagem agora inicia diretamente seu fluxo de aplicação.
- Importação de bibliotecas para compêndios recebeu prévia de sincronização, explicação do critério por ID, aviso sobre nomes iguais, textos mais claros e interface internacionalizada.
- Consumo de munição passou a respeitar o modo do equipamento — quantidade ou cargas — inclusive quando a própria arma é sua fonte de munição.
- Cards de equipamentos exibem as cargas restantes em todas as localizações da ficha.

### Removed

- Compêndio legado de Automações de Status, substituído pela configuração mundial de status.

### Fixed

- Avisos de compatibilidade do Foundry v13 ao mover itens para compêndios e ao remover metadados de aplicações de modelos.
- Processamento de arrastar e soltar que encaminhava eventos incompatíveis à API de `DragEvent` do Foundry.
- Contraste, alinhamento e dimensionamento das janelas de status, importação de compêndios, configuração de modelos e seleção de fontes de pagamento.
- Organização dos controles de conflitos e do resumo final na aplicação de modelos.

## [1.4.0-beta] - 2026-10-09

### Added

- Novo fluxo de aplicação de modelos, com etapas configuráveis, escolhas, pacotes, limites de atributos e orçamentos compartilhados de pontos e dinheiro.
- Perfis de munição vinculáveis aos equipamentos, com seleção durante o ataque e aplicação segura das alterações de dano.
- Visualizações separadas para Ações de Combate e Favoritos, agrupamento dos favoritos por tipo de item e filtros por grupo de ataque.
- Expansão mecânica em todos os cards de magias e poderes, incluindo conjuração ou ativação, duração, custo e manutenção sem cortes.

### Changed

- Ficha do personagem recebeu um padrão visual mais compacto e consistente para perícias, características, condições, magias, poderes, aspectos sociais e combate.
- Cards de magias e poderes passaram a aceitar arrastar e soltar, expansão persistente e menus de ações unificados; o mesmo padrão foi aplicado aos favoritos de combate.
- Cabeçalhos, cards, menus e janelas auxiliares das áreas revisadas receberam internacionalização ampliada em português e inglês.
- Aba de combate, tabela de RD, barra lateral e editor de atributos secundários foram reorganizados para melhorar leitura e reduzir ruído visual.
- Reservas de energia e de poder agora aceitam saldos negativos em seus registros.
- Editor de atributos secundários passou a exibir por extenso os nomes das modalidades de dano básico.

### Fixed

- Prévia de arraste de perícias e magias agora representa somente o card selecionado, sem capturar a ficha ou o grupo inteiro.
- Expansão de cards sociais deixou de recolher o grupo ou a aba inteira, e seus menus de opções voltaram a responder corretamente.
- Textos extensos dos cards revisados agora quebram linha ou ficam disponíveis na expansão, evitando perda silenciosa de informações.
- Colisões entre classes visuais legadas e os novos componentes de cards, cabeçalhos e menus foram removidas.

## [1.3.2-beta] - 2026-10-05

### Added

- Modificadores de equipamento com features estruturadas para propriedades, RD localizada, modos de ataque, descritores e efeitos concedidos.
- Reservas de uso/carga de equipamentos, com suporte a registros de combate, poder ou magia e à visibilidade configurável conforme a localização do item.
- Bônus de Defesa (BD) ativável por equipamento: aplica-se a Esquiva, Aparar e Bloqueio, com indicação opcional no chat quando determina um sucesso ou falha.

### Changed

- Fichas de equipamento e modificador de equipamento reorganizadas com campos em cards, tooltips e layout mais compacto.
- Modos de ataque concedidos ou modificados passaram a exibir seus valores e alterações resolvidos na ficha de equipamento.
- Controles de efeitos acionáveis por evento de uso foram separados dos demais controles nos cards de itens.
- Textos das fichas de equipamento e modificador receberam cobertura ampliada em português e inglês.

### Fixed

- Operações de substituição em propriedades de carga agora sobrescrevem corretamente o valor local do equipamento.
- Valores finais de BD preservam outros modificadores de efeito ao atualizar as defesas ativas e as rolagens.

## [1.3.1-beta] - 2026-09-27

### Added

- Acrescentado expressões condicionais para valores de itens efeito

## [1.3.0-beta] - 2026-09-20

### Added

- Serviço central e janela de configuração para escolher, ordenar e validar múltiplas fontes de conteúdo por função do sistema.
- Suporte a fontes configuráveis nos navegadores, solicitações de teste, modificadores de rolagem, condições passivas, vínculos de status e importação híbrida de personagens.
- Migração automática da configuração legada de Vínculos de Status.
- Organização híbrida de perícias e características, com grupos personalizados, ordenação manual e controles integrados à ficha.
- Importação de bibliotecas do GCS com reconstrução da hierarquia de contêineres de equipamentos.

### Changed

- Navegadores e automações deixaram de depender de IDs fixos de compêndios e passaram a preservar a identidade completa das fontes.
- Importação híbrida passou a priorizar Itens do mundo, fontes configuradas e, opcionalmente, outros compêndios.
- Compêndios funcionais do GUM passaram a ser organizados em uma única pasta raiz `GUM`.
- Janela de Fontes de Conteúdo recebeu apresentação visual mais sóbria, compacta e objetiva.
- Cartões e diálogos de perícias, cabeçalhos de características e abas de equipamentos foram reorganizados para melhorar leitura e navegação.
- Importador de compêndios ganhou seleção mais clara, ações revisadas e melhor tratamento de bibliotecas e contêineres do GCS.
- Resultado dos testes de barreira de resistência passou a apresentar as margens de forma mais clara.
- Contêineres de equipamentos passaram a oferecer melhor feedback de carga, ordenação por arraste e movimentação automática de itens.

### Removed

- Compêndios distribuídos de Vantagens, Desvantagens, Equipamentos, Magias e Poderes, agora substituíveis por bibliotecas mundiais configuradas pelo Mestre.

### Fixed

- Colisões de IDs locais entre documentos de compêndios diferentes nos navegadores.
- Inicialização prematura do serviço de fontes antes da disponibilidade de `game`, `game.settings` e `game.packs`.
- Seleção ambígua de perícias com mesmo nome e especializações diferentes durante importações e solicitações.
- Sincronização de Condições Passivas voltou a adicionar regras novas aos personagens existentes, além de atualizar as cópias já vinculadas.
- Cálculo, visibilidade e valores ARIA do progresso de carga dos contêineres de equipamentos.
- Escopo de operações de arrastar e soltar, preservando a ordem de contêineres e evitando movimentações indevidas.
- Contraste dos seletores e disponibilidade das ações na janela de importação de compêndios.

## [1.0.0] - 2026-08-01

Primeira versão pública do GURPS GUM para Foundry VTT.

### Added

- Ficha de personagem com atributos, recursos, cálculos derivados, carga e organização de perícias, vantagens, desvantagens, equipamentos, magias e poderes.
- Tipos de item e fichas próprias para os principais elementos do sistema.
- Motor de efeitos, condições, gatilhos, vínculos de status e regras passivas.
- Aplicação de dano com suporte às principais avaliações usadas pelo GUM.
- Navegadores de modificadores, efeitos, condições, gatilhos, modelos e modificadores de equipamento.
- Escudo do Mestre e ferramentas de apoio à condução da sessão.
- Compêndios públicos e estrutura de conteúdo reutilizável.
- Importação de personagens e modelos do GCS.
- Importação e exportação de compêndios em JSON, com preservação de IDs e sincronização segura.
- Exportação de fichas de personagem em JSON.
- Guia de publicação (`RELEASE.md`) e validação automática do manifesto e da estrutura mínima.

### Changed

- Interface das fichas e itens reorganizada para facilitar leitura e uso durante a sessão.
- Abas de magias e poderes aprimoradas, incluindo habilidade de conjuração e reservas de energia.
- Apresentação de condições, efeitos e ícones de status aprimorada.
- `system.json` preparado para instalação e atualização por Manifest URL.
