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
- Preferir mudanças pequenas e objetivas por vez, fáceis de revisar.
- Anexos (Locação, Recebimento de Aluguel, Recebimento de Caução) sobem para o Supabase Storage (bucket `uploads`), nunca para disco local — o disco do Vercel é efêmero e não persiste entre deploys. Anexos salvos antes dessa migração (URL relativa, tipo `/uploads/arquivo.ext`) apontam para arquivos já perdidos e não têm como ser recuperados.
- Ver também: `SETUP_AMBIENTE_LOCAL.md` na raiz do projeto para mais contexto histórico do setup local.

### Autonomia padrão (não precisa perguntar de novo)

- Está liberado, por padrão, alterar código, testes, documentação e configuração de Git (criar branch, `git add`, `git commit`) sem precisar pedir permissão a cada vez. Se der pra mexer direto no banco (Supabase) com segurança, também está liberado — se não der (sem acesso/credencial), avisar e o Cadu faz essa parte.
- `git push`: quem dá o push é o Cadu, manualmente, pelo VS Code — combinado assim porque, em alguns ambientes, o Claude nem tem credencial de push liberada para este repositório (ex.: sandbox web/Cowork sem o repo autorizado). Nesses casos, preparar o(s) commit(s) prontos (numa branch, nunca direto na `main`) e entregar pro Cadu aplicar/pushar, com a mensagem de commit sugerida. Se o ambiente permitir dar o push diretamente (ex.: Claude Code local já autenticado), também está liberado a fazer — não precisa perguntar antes, só avisar o que foi pushado.
- Isso vale como regra permanente: não é preciso o Cadu repetir essa autorização a cada conversa.

### Fluxo padrão para bug/feature novo encontrado

Regra do Cadu (vale sempre, sem precisar pedir de novo): "crie o ticket no
kanban do sistema duvoenterprise, preencha com todos os detalhes para que
o ticket explique exatamente o que é o erro, o que deve ser feito como
tarefas e que tenha os critérios de aceitação, escritos em BDD para que
seja testado os cenários. Replique esse ticket para o kanban do GitHub.
Atualize a documentação e os manuais caso necessário para que tudo
sempre reflita a realidade."

Na prática, isso significa:

1. Criar o ticket no kanban interno (https://duvoenterprise.com.br/kanban), respeitando prioridade/coluna, explicando exatamente o que é o erro (contexto + causa raiz, com arquivo/linha se já identificada no código) e o impacto.
2. Listar as tarefas necessárias para corrigir.
3. Escrever os critérios de aceitação em BDD/Gherkin (Dado/Quando/Então), cobrindo os cenários que precisam ser testados.
4. Espelhar o mesmo ticket como issue no GitHub (`CaduCondo/sistemaDuvoEnterprise`), com label e adicionado ao Project "Sistema DUvoEnterprise", com o mesmo conteúdo.
5. Ao implementar a correção, manter os dois tickets sincronizados (status e conteúdo) — se algum critério de aceitação mudar durante o desenvolvimento (ex.: uma regra de negócio foi refinada com o Cadu), corrigir o texto nos dois lugares, não só num.
6. Atualizar a documentação e os manuais relevantes (ex.: `docs/REGRAS_DE_NEGOCIO.md`) sempre que necessário, para que reflitam o comportamento real do sistema, e não o que já foi corrigido/mudado.
