# Contexto do projeto — leia sempre ao entrar neste repositório

## Sobre o usuário

- Cadu — não é desenvolvedor, precisa de explicações detalhadas e passo a passo, sem pular etapas.
- Usava o Softgen.ai para desenvolver via prompts, mas parou de usar (custo alto) em agosto de 2026. Todo resíduo do Softgen no código (script de monitoramento, pasta `.softgen/`, scripts de sync, dependência `@softgenai/element-tagger`) já foi removido do projeto. Agora desenvolve com ajuda do Claude (chat + Claude Code).

## O sistema

- Sistema de gerenciamento de locações de imóveis: propriedades, inquilinos, contratos de locação, recebimentos/pagamentos, caução, dashboard financeiro, geração de contratos/recibos.
- Stack: Next.js 15 (Pages Router) + TypeScript, Supabase (banco, auth, storage de anexos), Tailwind CSS + shadcn/ui.
- Deploy: Vercel — publica automaticamente a nova versão em produção a cada push no GitHub.
- Repositório: https://github.com/CaduCondo/sistemaDuvoEnterprise

## Ambiente do usuário

- Editor: VS Code, com a extensão Claude Code instalada.
- Supabase: bancos de dados separados de dev e prod (atenção: alguns campos já divergiram de tipo entre os dois bancos — ver ticket "attachments de deposit_installments" no kanban — sempre confirmar o schema real antes de escrever SQL para produção).
- Kanban de tarefas: https://duvoenterprise.com.br/kanban — é a fonte de verdade sobre bugs conhecidos e prioridades, não este arquivo. Respeitar a prioridade e a ordem das tarefas de lá; bugs novos que forem aparecendo devem virar tickets novos no kanban, respeitando a prioridade (não furar fila).

## Regras de trabalho

- Sempre explicar o que vai ser mudado ANTES de mudar, e depois explicar o que foi feito, em linguagem simples (o usuário não programa).
- Nunca commitar/dar `git push` sem avisar antes e sem confirmação explícita do usuário — sempre sugerir a mensagem de commit.
- Preferir mudanças pequenas e objetivas por vez, fáceis de revisar.
- Anexos (Locação, Recebimento de Aluguel, Recebimento de Caução) sobem para o Supabase Storage (bucket `uploads`), nunca para disco local — o disco do Vercel é efêmero e não persiste entre deploys. Anexos salvos antes dessa migração (URL relativa, tipo `/uploads/arquivo.ext`) apontam para arquivos já perdidos e não têm como ser recuperados.
- Ver também: `SETUP_AMBIENTE_LOCAL.md` na raiz do projeto para mais contexto histórico do setup local.
