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
  - Por baixo do capô, esse kanban é só duas tabelas no Supabase de **produção** (`kanban_cards` e `kanban_card_tasks`, ref `alvghyfbzrpjwhckmkwx`) — o mesmo banco que o site usa. O `.env.local` do projeto aponta para o Supabase de DEV (`yrknfweilbuwrhzzwnrr`); não existe credencial de produção no repositório. Então, sem uma `SUPABASE_SERVICE_ROLE_KEY` de produção à mão, o jeito de ler/escrever o kanban interno é pela tela mesmo (`https://duvoenterprise.com.br/kanban`, dentro do "Gerenciador"), via navegador.
  - **Login no Gerenciador é sempre o Cadu quem faz.** O botão "Entrar" não deve ser clicado pelo Claude mesmo com o e-mail/senha já preenchidos pelo autofill do navegador — pedir para o Cadu logar na aba antes de continuar.
  - Cadu pretende, no futuro, parar de usar esse kanban interno e usar só o do GitHub (issues + Project "Sistema DUvoEnterprise") — mais usado no mercado. Até ele avisar que fez a troca, os dois continuam sendo mantidos sincronizados (ver "Os dois kanbans sempre sincronizados e priorizados" abaixo).
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
   explicitamente estas frentes (nenhuma pode ser pulada, mesmo quando a
   conclusão for "não precisa mudar nada"):
   - **Documentação desatualizada:** se alguma coisa mudou que deixa a
     documentação/manual desatualizados (ex.: `docs/REGRAS_DE_NEGOCIO.md`
     e os outros arquivos de `docs/`).
   - **Documentação duplicada/desnecessária:** ao mexer numa área,
     aproveitar para checar se não sobrou documento repetido, esquecido
     ou um "index" (`docs/README.md`, `e2e/README.md`) desatualizado
     sobre o que existe. Não confiar cegamente numa nota antiga tipo
     "arquivo X foi removido" — conferir se o arquivo realmente não
     existe mais antes de repetir a afirmação (já aconteceu de um índice
     dizer que `e2e/SETUP_SIMPLES.md` tinha sido removido em 12/ago/2026
     quando na verdade ele nunca foi).
   - **Manual passo a passo + imagens:** o manual (`docs/REGRAS_DE_NEGOCIO.md`)
     é para o Cadu, que não programa — cada regra de negócio nova ou
     alterada precisa ficar como passo a passo em linguagem simples, não
     só como especificação técnica. Sempre que mexer numa tela que tenha
     um placeholder `[Imagem]` (hoje só 2, ambos mockups em ASCII —
     "Imóveis" e outro bloco de cards — grep por `\[Imagem\]` acha os
     atuais), aproveitar para capturar um print real da tela (navegador,
     logado como o Cadu loga) e substituir o mockup pela imagem de
     verdade. Não precisa esperar pedido específico do Cadu.
   - **Testes automáticos (BDD, pasta `e2e/`):** se o comportamento
     corrigido/criado já está coberto pelos testes automáticos. Se não
     estiver, criar ou atualizar o cenário BDD (Dado/Quando/Então)
     correspondente — ver "Esquema de tags dos testes BDD" abaixo para
     decidir em qual rodada (`@smoke`/`@sistemaCompleto`) o cenário novo
     entra, e lembrar da tag de página do arquivo.
   - **Um teste que já existia e não pegou o bug:** se o item chegou
     aqui através de um bug relatado pelo Cadu ou encontrado pelo
     GitHub Actions, e já existia um cenário BDD para aquela regra,
     investigar por que ele não acusou o problema (cenário errado?
     estava fora de `@smoke`/`@sistemaCompleto`? é um dos `@quebrado`?)
     e corrigir a causa, não só adicionar um cenário nôvo por cima.
   Pular esse passo no passado foi exatamente o que fez a documentação
   (e a cobertura de testes) acumular desatualização — por isso agora é
   sempre avaliado, em todos os casos.
10. **Escolher e já sinalizar o próximo item** (kanban + GitHub), e
    recomeçar o ciclo — sem esperar o Cadu perguntar "qual o próximo?".
    Ver "Os dois kanbans sempre sincronizados e priorizados" abaixo antes
    de escolher: a escolha só é confiável se a fila estiver correta nos
    dois lugares.

### Os dois kanbans sempre sincronizados e priorizados

Regra do Cadu (31/ago/2026, vale sempre, sem precisar pedir de novo, além
do "Fluxo padrão" acima que já cobre ticket-a-ticket): isto não é uma
auditoria pontual — é hábito permanente do ciclo, revisado a cada item
trabalhado, não só quando alguém lembrar:

1. **Mesmo conteúdo nos dois.** Todo ticket do kanban interno tem que ter
   o par exato no GitHub Issues (`CaduCondo/sistemaDuvoEnterprise`) e
   vice-versa — mesmo título, mesmo contexto/causa raiz, mesmas tarefas,
   mesmos critérios de aceitação em BDD. Se algum dos dois tiver algo que
   o outro não tem, replicar antes de seguir.
2. **Uma fila só de prioridade.** Os tickets abertos, nos dois kanbans,
   ficam ordenados do mais urgente para o menos urgente — sempre que um
   item novo entra (bug achado, pedido do Cadu, falha do GitHub Actions),
   reavaliar a posição dele na fila junto com o resto, não só apendar no
   fim. O critério é o do passo 1 do ciclo (valor, custo/esforço, risco,
   urgência).
3. **Kanban interno precisa do Cadu logado.** Ver nota em "Ambiente do
   usuário" — o Claude não faz login sozinho. Se a aba do Gerenciador não
   estiver logada quando for hora de mexer no kanban interno, pedir para
   o Cadu logar e continuar depois.
4. Isso é preparação para o dia em que o Cadu avisar que só quer mais o
   kanban do GitHub — quanto mais os dois já estiverem espelhados e
   íntegros nesse dia, mais simples é a migração.

### Esquema de tags dos testes BDD (`e2e/features/*.feature`)

Decisão do Cadu de 31/ago/2026, documentação completa em `e2e/SMOKE.md`
(ler antes de mexer em tags) — resumo para não ter que reabrir o arquivo
toda vez:

- **`@smoke`** — rodada 1, roda primeiro a cada push. Só os poucos
  cenários rápidos e **críticos** (login, criar imóvel/inquilino/locação,
  receber caução, os dois cenários essenciais da rescisão). Hoje são 12.
- **`@sistemaCompleto`** — rodada 2, só começa depois que a 1 passar
  (`needs: smoke` no workflow). Todo o resto — cada regra de negócio,
  cada variação de cálculo. Por definição cobre tudo que o `@smoke` não
  cobre; nenhum cenário tem as duas tags.
- **`@quebrado`** — defeito conhecido **do teste** (não do sistema): o
  preparo não cria o dado que o cenário confere, ou procura elemento que a
  tela nunca teve. Fica fora das duas rodadas até ser corrigido — não
  apagar o cenário, só sinalizar. Hoje: 4 (ver `e2e/SMOKE.md`).
- **Sem tag nenhuma** — o cenário é o contrato de uma funcionalidade que
  ainda **não existe** no produto (não é bug de teste). Fica assim até a
  funcionalidade ser implementada; devolver a tag correta nesse momento.
- **Tag de página** — uma por arquivo `.feature`, no topo (`@autenticacao`,
  `@imoveis`, `@inquilinos`, `@locacoes`, `@pagamentos`, `@caucoes`,
  `@rescisao`, `@anuncioPublico`, `@permissoesAdmin`,
  `@permissoesFinanceiro`, `@permissoesGestao`, `@regressaoVisual`,
  `@fundacao`). Todo cenário do arquivo herda ela — não precisa repetir
  por cenário. Serve para rodar só uma tela: `--tags "@rescisao"`.
- Tags que existem e não são do BDD: `@security`, `@performance`,
  `@stress`, `@permissions`, `@api-tests`, `@regression` são **projetos do
  Playwright** (`playwright.config.ts`), usados pelos `.spec.ts` em
  `e2e/tests/*` — outro tipo de teste (XSS/SQL injection, tempo de
  carregamento, requisições concorrentes), roda só no workflow manual
  `e2e-tests.yml`. Não misturar com as tags do Cucumber acima.

Todo cenário novo entra com exatamente uma tag de rodada (`@smoke`,
`@sistemaCompleto`, ou `@quebrado`/sem-tag nos dois casos de exceção). Um
cenário só vira `@smoke` se for rápido, confiável, criar o próprio dado, e
**crítico** (quebrar isso para o sistema ou mexe em dinheiro) — o padrão é
`@sistemaCompleto`.

Lacuna conhecida (31/ago/2026): não existe ainda um cenário `@smoke`
limpo para "receber aluguel" — os dois candidatos naturais estão
`@quebrado`. Ver ticket "Escrever cenário de smoke para receber aluguel"
no kanban/GitHub.
