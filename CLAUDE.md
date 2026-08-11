# Contexto do projeto — leia sempre ao entrar neste repositório

## Sobre o usuário

- Não é desenvolvedor(a), precisa de explicações detalhadas e passo a passo, sem pular etapas.
- Estava usando o Softgen.ai para desenvolver via prompts, mas parou de usar (custo alto). Agora desenvolve com ajuda do Claude (chat + Claude Code).

## O sistema

- Sistema de gerenciamento de locações de imóveis: propriedades, inquilinos, contratos de locação, recebimentos/pagamentos, caução, dashboard financeiro, geração de contratos/recibos.
- Stack: Next.js 15 (Pages Router) + TypeScript, Supabase (banco, auth, storage de anexos), Tailwind CSS + shadcn/ui.
- Deploy: Vercel — publica automaticamente a nova versão em produção a cada push no GitHub.
- Repositório: https://github.com/CaduCondo/sistemaDuvoEnterprise

## Ambiente do usuário

- Editor: VS Code, com a extensão Claude Code instalada.
- Supabase: bancos de dados separados de dev e prod.
- Kanban de tarefas: https://duvoenterprise.com.br/kanban — respeitar a prioridade e a ordem das tarefas de lá; bugs novos que forem aparecendo devem virar tickets novos no kanban, respeitando a prioridade (não furar fila).

## Regras de trabalho

- Sempre explicar o que vai ser mudado ANTES de mudar, e depois explicar o que foi feito, em linguagem simples (o usuário não programa).
- Nunca commitar/dar `git push` sem avisar antes e sem confirmação explícita do usuário — sempre sugerir a mensagem de commit.
- Preferir mudanças pequenas e objetivas por vez, fáceis de revisar.
- Ver também: `SETUP_AMBIENTE_LOCAL.md` e `SYNC_SOFTGEN_GITHUB.md` na raiz do projeto para mais contexto histórico.

## Status atual — bugs diagnosticados, ainda não corrigidos

Encontrados testando a tela de edição de Locação (anexos):

1. Botão "Visualizar" de arquivo Word (.doc/.docx) faz download em vez de abrir. Causa: navegador não exibe .docx inline. Fix: mostrar "Visualizar" só para imagem/PDF; para os demais, só "Baixar". Arquivo: `src/components/AttachmentViewer.tsx`.
2. Seta de "próxima foto" no fim do carrossel de anexos aciona por engano o salvamento da locação. Causa: os botões de navegação do lightbox não têm `type="button"`, então o navegador os trata como submit do formulário. Arquivo: `src/components/Lightbox.tsx`.
3. OK da mensagem de sucesso abre a tela de Contrato; depois abre o contrato errado ao clicar em outra locação. Causa: duas telas empilhadas (alerta de sucesso + contrato) deixam dados presos quando o contrato não é fechado pelo caminho esperado. Fix combinado: não auto-abrir o Contrato após uma edição; na criação, mostrar o Contrato primeiro e o aviso de sucesso só depois de fechá-lo. Arquivo: `src/components/rentals/RentalFormDialog.tsx`.
