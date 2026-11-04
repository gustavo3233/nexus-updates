# Nexus Construção e Reformas

Base do sistema nativo para gestão de clientes, obras, orçamentos, parcelamentos, custos, documentos e notas fiscais.

## Produtos planejados

- `apps/mobile`: aplicativo instalado para Android e iOS, com React Native e NativeWind.
- `apps/desktop`: aplicativo instalado para computador, com Tauri, React e Tailwind CSS.
- `services/api`: API central em TypeScript para sincronização e regras de negócio.
- `packages`: módulos compartilhados, como tipos, validações, regras financeiras e tokens visuais.

Os aplicativos não serão versões web abertas no navegador. Eles usarão um serviço central para manter os dados sincronizados entre celular e computador.

## Fluxo de desenvolvimento

Antes de qualquer alteração, siga o checklist em [AGENTS.md](AGENTS.md). Toda funcionalidade deve ser planejada, implementada de forma incremental e verificada antes da entrega.

A identidade visual está registrada em [docs/design-system.md](docs/design-system.md); ela será transformada em tokens compartilhados antes da criação das telas.

## Próximo passo recomendado

Criar o monorepositório inicial e começar pelo módulo de clientes, que será a pasta central para obras, serviços, orçamentos, parcelas, documentos e notas fiscais.
