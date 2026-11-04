# Regras de desenvolvimento — Nexus Construção e Reformas

Estas instruções se aplicam a toda alteração neste repositório.

## Processo obrigatório antes de alterar

1. Verifique o estado do repositório e os arquivos envolvidos.
2. Leia os arquivos que serão modificados e identifique dependências afetadas.
3. Planeje uma mudança mínima, limitada ao pedido aprovado.
4. Quando a mudança alterar comportamento existente, explique o impacto antes de executá-la.
5. Após alterar, execute verificações compatíveis (testes, lint, tipos e/ou build) e informe o resultado real.

## Preservação e escopo

- Não modifique, exclua ou reformule funcionalidades existentes sem autorização explícita.
- Não faça mudanças globais quando uma mudança localizada for suficiente.
- Não crie funcionalidades fora do pedido aprovado.
- Não use comandos destrutivos, não descarte alterações alheias e não exponha segredos.

## Arquitetura e qualidade

- Mantenha interface, domínio, infraestrutura e configurações separados.
- Prefira componentes reutilizáveis e nomes claros; evite duplicação e arquivos excessivamente grandes.
- Mudanças no banco devem ser feitas por migrações controladas e documentadas.
- Validações e permissões devem existir no servidor, não apenas na interface.
- Registre operações financeiras e administrativas relevantes em histórico de auditoria.
- Não apresente dados fictícios como se fossem dados reais; implemente estados de carregamento, vazio e erro.

## Identidade visual

- Use a identidade Nexus fornecida como fonte oficial.
- Centralize tokens de cor, tipografia, espaçamento, bordas e componentes; não replique valores arbitrários nas telas.
- Para o aplicativo móvel, use NativeWind; para o desktop, Tailwind CSS.

## Entrega

Ao concluir uma tarefa, informe: pedido, implementação, arquivos criados/modificados, impacto em funcionalidades existentes, testes executados, pendências e recomendações relevantes.
