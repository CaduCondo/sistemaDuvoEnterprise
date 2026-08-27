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
- Pasta do projeto conectada diretamente (21/ago/2026): o Claude consegue ler e escrever os arquivos locais do Cadu (a mesma pasta aberta no VS Code) sem precisar passar por Git. Isso significa que o código já aparece atualizado no VS Code do Cadu assim que o Claude termina de mexer — ele não precisa dar `git pull`. `git commit`/`git push` continuam sendo só para levar a mudança para o GitHub/produção (Vercel), e continuam exigindo autorização do Cadu como sempre.

## Regras de trabalho

- Sempre explicar o que vai ser mudado ANTES de mudar, e depois explicar o que foi feito, em linguagem simples (o usuário não programa).
- Respostas curtas, resumidas e diretas ao ponto — sem parágrafos longos nem listas de opções que não serão seguidas. Se for preciso mais detalhe, o Cadu pede.
- Preferir mudanças pequenas e objetivas por vez, fáceis de revisar.
- Anexos (Locação, Recebimento de Aluguel, Recebimento de Caução) sobem para o Supabase Storage (bucket `uploads`), nunca para disco local — o disco do Vercel é efêmero e não persiste entre deploys. Anexos salvos antes dessa migração (URL relativa, tipo `/uploads/arquivo.ext`) apontam para arquivos já perdidos e não têm como ser recuperados.
- Ver também: `SETUP_AMBIENTE_LOCAL.md` na raiz do projeto para mais contexto histórico do setup local.

### Autonomia padrão (não precisa perguntar de novo)

- Está liberado, por padrão, alterar código, testes, documentação e configuração de Git (criar branch, `git add`) sem precisar pedir permissão a cada vez. Se der pra mexer direto no banco (Supabase) com segurança, também está liberado — se não der (sem acesso/credencial), avisar e o Cadu faz essa parte.
- `git commit`: **COMMITAR SEMPRE, SEM PERGUNTAR** (regra do Cadu, 27/ago/2026 — substitui a
  regra anterior de pedir autorização). Todo bug corrigido, feature pronta, parte de feature
  que valha a pena guardar, ajuste de tela, documentação — commita na hora, assim que ficar
  de pé. Não esperar o fim da conversa, não esperar o Cadu pedir, não juntar várias coisas
  num commit só para "não incomodar".
  - Commit **não** é publicação: não sobe nada para o GitHub, não afeta produção, não afeta
    ninguém. É só salvar. O que exige autorização é o `push`, não o commit.
  - Avisar o Cadu **no meio da própria resposta**, em uma linha, dizendo o que foi commitado.
    Não é preciso pedir permissão nem interromper o trabalho para isso.
  - **Por que essa regra existe:** em 26/ago/2026 uma sessão terminou com horas de ajustes de
    tela nunca commitados. O trabalho se perdeu inteiro e o Cadu passou por um susto grande
    achando que três dias tinham sido perdidos. Não deixar trabalho pendente sem commit é
    obrigação do Claude, não do Cadu.
  - Antes de terminar QUALQUER resposta, conferir `git status`. Se houver arquivo modificado,
    commitar antes de responder.
- `git push`: SEMPRE perguntar antes de dar o push, mesmo quando o ambiente permite fazer direto (ex.: Claude Code local já autenticado). Só dar o push depois do Cadu confirmar.
- Isso vale como regra permanente: não é preciso o Cadu repetir essa autorização a cada conversa.
- Push é sempre manual pelo Cadu (Source Control do VS Code) — o Claude não alcança a internet do computador dele. Por isso, para não encavalar pushes enquanto os testes do GitHub Actions de um push anterior ainda estão rodando, o Claude pode ir *commitando* várias mudanças pequenas (sempre com autorização, uma a uma) e deixá-las empilhadas localmente, e o Cadu dá um push só juntando tudo quando quiser — evita poluir o histórico do GitHub com pushs desnecessários.

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

### Claude é o dono do backlog — ciclo de trabalho contínuo

Regra do Cadu (27/ago/2026, vale sempre, sem precisar pedir de novo): o
Claude é quem toca o backlog do início ao fim. O Cadu não vai ficar
pedindo passo a passo — se ele esquecer de pedir algo (ex.: atualizar a
documentação), o Claude tem que lembrar sozinho. O Cadu não é
desenvolvedor: toda explicação, resumo ou pergunta para ele tem que ser
em linguagem simples, sem termos técnicos ("tecnês") — se precisar citar
algo técnico, traduzir o impacto em termos do dia a dia do sistema.

O ciclo, item por item do backlog, é este (a ordem interna dos passos
pode variar conforme o caso, mas nenhum passo pode ser pulado):

1. **Escolher o próximo item.** O Claude prioriza o backlog sozinho,
   combinando valor (pro usuário/negócio), custo/esforço, risco e
   urgência — não segue só a ordem que o Cadu foi citando os itens,
   porque o Cadu mesmo não sabe qual é a melhor ordem técnica.
2. **Todo trabalho nasce como item do backlog primeiro.** Antes de mexer
   em código, o item já precisa existir no kanban interno e como issue
   no GitHub (ver seção acima), mesmo que ainda incompleto.
3. **Preencher o item enquanto analisa.** Ao investigar o problema, ir
   completando contexto, causa raiz e critérios de aceitação (BDD) do
   próprio item — o ticket tem que ficar cada vez mais claro conforme o
   Claude entende o problema, não só no início.
4. **Implementar.** Alterar o código para corrigir o bug ou construir a
   feature que o item pede.
5. **Git — sempre com autorização do Cadu:**
   - `commit`: sempre perguntar antes, mostrando a mensagem de commit e
     um resumo simples do que está sendo alterado.
   - `push`: sempre perguntar antes. Se o ambiente permitir o Claude
     pushar direto, só fazer depois do "sim" do Cadu. Se o ambiente
     não der essa credencial pro Claude, avisar isso claramente e pedir
     pro Cadu dar o push manualmente (passando o branch/commit certo).
6. **Depois do push, checar o GitHub Actions.** Ver se os testes
   automatizados passaram. Se algum teste falhou, investigar o erro e
   criar um novo item no backlog (kanban + issue no GitHub) já
   descrevendo o bug encontrado pela automação — seguindo o mesmo
   padrão da seção "Fluxo padrão" acima (contexto, tarefas, BDD).
7. **Priorizar o que for criado no passo 6** dentro do backlog, junto
   com o resto (não é só "jogar lá pra depois" — decidir onde entra na
   fila, usando o mesmo critério do passo 1).
8. **Fechar o item.** Atualizar kanban interno e issue do GitHub
   (mover de coluna, fechar), com um comentário simples explicando o
   que foi feito.
9. **Checar a documentação E os testes automáticos — sempre, sem
   exceção.** Antes de considerar o item realmente concluído, avaliar
   explicitamente duas coisas (nenhuma pode ser pulada, mesmo quando a
   conclusão for "não precisa mudar nada"):
   - **Documentação:** se alguma coisa mudou que deixa a
     documentação/manual desatualizados (ex.: `docs/REGRAS_DE_NEGOCIO.md`
     e os outros arquivos de `docs/`).
   - **Testes automáticos (BDD, pasta `e2e/`):** se o comportamento
     corrigido/criado já está coberto pelos testes automáticos que rodam
     no GitHub Actions a cada push. Se não estiver, criar ou atualizar o
     cenário BDD (Dado/Quando/Então) correspondente, para que esse
     comportamento passe a ser testado sempre, automaticamente, e o
     mesmo problema não volte sem ser percebido.
   Pular esse passo no passado foi exatamente o que fez a documentação
   (e a cobertura de testes) acumular desatualização — por isso agora é
   sempre avaliado, nos dois casos.
10. **Escolher e já sinalizar o próximo item** (kanban + GitHub), e
    recomeçar o ciclo — sem esperar o Cadu perguntar "qual o próximo?".

Manual/documentação com imagens: o manual (`docs/REGRAS_DE_NEGOCIO.md`)
tem vários pontos marcados como `[Imagem]` que nunca foram preenchidos
com capturas de tela reais. Sempre que mexer numa tela que tenha um
desses placeholders, aproveitar para capturar um print atual e inserir
no lugar do placeholder — não precisa esperar um pedido específico do
Cadu para isso.
