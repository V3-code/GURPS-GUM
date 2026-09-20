# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue uma adaptação de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e usa [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

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