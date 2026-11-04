# Sistema visual — Nexus

Referência: styleboard oficial fornecido para o Nexus Construção e Reformas.

## Tipografia

- Família principal: `Inter` (ou equivalente compatível, caso a plataforma exija fallback).
- Título H1: Inter Bold, 28 px.
- Subtítulo H2: Inter SemiBold, 20 px.
- Texto padrão: Inter Regular, 16 px.
- Texto pequeno: Inter Medium, 14 px.

## Cores institucionais

| Token | Cor | Uso |
| --- | --- | --- |
| `brand.primary` | `#FF7A00` | Ações principais, botões e destaques. |
| `brand.dark` | `#E56600` | Estado ativo, hover e foco. |
| `neutral.900` | `#1F2937` | Menus, textos principais e cabeçalhos. |
| `neutral.500` | `#6B7280` | Texto secundário e ícones. |
| `neutral.200` | `#E5E7EB` | Bordas, fundos e divisores. |
| `success` | `#16A34A` | Confirmações e estados positivos. |
| `error` | `#EF4444` | Erros e alertas críticos. |
| `warning` | `#F59E0B` | Avisos e informações de atenção. |

## Padrões de interface

- Navegação escura, com ação ativa em laranja.
- Conteúdo claro, com cartões, bordas suaves e boa separação visual.
- Botões principal, secundário, contorno e desabilitado devem manter o mesmo padrão em todo o produto.
- Campos, tabelas, estados de feedback e ícones devem ser centralizados em componentes reutilizáveis antes de serem usados nas telas.
- Interfaces mobile devem priorizar ações rápidas, resumo de obra e navegação simples; interfaces desktop podem apresentar tabelas e painéis mais densos.

## Aplicação técnica futura

Os tokens serão implementados em uma única fonte compartilhada: configuração Tailwind para desktop e tokens compatíveis com NativeWind para mobile. Componentes não devem declarar cores institucionais diretamente.
