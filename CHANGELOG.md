# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue uma adaptação de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e usa [SemVer](https://semver.org/lang/pt-BR/).

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
- Endereços do projeto normalizados para `V3-code/GURPS-GUM`.
- Compatibilidade definida para Foundry VTT 13 ou superior, verificada na versão 14.

### Fixed

- Importação de compêndios corrigida para atualizar entradas pelo `_id`, criar apenas registros novos e evitar duplicatas.
- Preservação dos IDs usados pelas ligações entre Condições e Efeitos.
- Restauração segura do estado de bloqueio do compêndio após a importação.
- Diversos ajustes visuais e de fluxo nas fichas, itens, efeitos, combate e aplicação de dano.
