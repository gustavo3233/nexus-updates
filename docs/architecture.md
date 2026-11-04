# Arquitetura inicial

## Princípios

- Aplicativos nativos, com uma API central e banco de dados compartilhado.
- TypeScript como linguagem principal.
- Separação entre interface, regras de negócio, persistência e integrações externas.
- Módulos independentes: clientes, obras, orçamentos, financeiro, documentos, fiscal e permissões.

## Estrutura prevista

```text
apps/
  mobile/       Aplicativo Android e iOS (React Native + NativeWind)
  desktop/      Aplicativo Windows/macOS (Tauri + React + Tailwind)
services/
  api/          API e regras protegidas no servidor
packages/
  domain/       Tipos e regras de negócio compartilhadas
  ui-tokens/    Cores, tipografia, espaçamentos e componentes-base
docs/           Arquitetura, decisões e documentação operacional
```

## Módulos de negócio previstos

1. Clientes: cadastro e pasta central do cliente.
2. Obras e serviços: vínculo entre cliente, escopo, status e período.
3. Orçamentos: versões, itens, aprovação e documentos.
4. Financeiro: parcelas, recebimentos, custos, mão de obra, margem e resultado.
5. Fiscal: documentos fiscais e parâmetros tributários configuráveis, sujeitos à validação contábil.
6. Documentos: anexos organizados por cliente e obra.
7. Acesso e auditoria: usuários, perfis, permissões e histórico de operações.

## Regra financeira importante

Percentuais internos, ICMS e outros tributos precisam ser configuráveis por empresa e, quando necessário, por obra. O cálculo fiscal definitivo deve ser validado por profissional contábil antes de ser usado para emissão fiscal oficial.
