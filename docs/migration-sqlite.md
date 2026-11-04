# Migração para SQLite — Nexus Desktop

## Garantias

- A migração cria um backup JSON verificável antes de gravar no banco.
- O conteúdo original do localStorage não é removido.
- IDs e relações entre cliente, orçamento, planilha, despesa, pedido e arquivo são preservados.
- A migração é transacional e idempotente.
- A importação do Dolibarr continua exclusivamente em leitura.

## Localização

O banco e os backups ficam no diretório de dados do Electron, em:

    nexus-data/nexus.sqlite
    nexus-data/backups/localstorage-before-sqlite-*.json

Cada backup possui um arquivo de manifesto com data, contagens e SHA-256 do conteúdo.

## Reversão

Se a migração não concluir a verificação de contagens, o banco executa rollback. Como o localStorage é preservado, a versão anterior ainda pode ser usada como fonte de contingência.

## Próxima arquitetura

As telas falam com o processo principal através de IPC. A regra de domínio não conhece SQLite; a futura API central poderá implementar os mesmos contratos de persistência usando PostgreSQL.
