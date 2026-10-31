# 🔄 Reset do banco de DEV a partir de PRODUÇÃO (issue #36)

## O que é

Uma rotina automática que **apaga o banco de DEV e coloca no lugar uma cópia
fresca do banco de PRODUÇÃO** — com os dados pessoais trocados por dados
falsos. Assim o DEV fica sempre parecido com a vida real (mesmas tabelas,
mesmos imóveis, mesmas locações, mesmos valores), sem expor dados de
inquilinos.

- **Quando roda:** todo **domingo às 3h da manhã** (horário de Brasília),
  sozinho. Também dá para rodar na hora que quiser (ver "Rodar agora" abaixo).
- **Onde roda:** GitHub Actions, workflow **"Reset do banco de DEV"**
  (arquivo `.github/workflows/reset-dev.yml`).
- **Produção nunca é alterada:** a rotina só **lê** produção.

## O que muda nos dados (e o que não muda)

| O quê | Em DEV depois do reset |
|---|---|
| Imóveis, locais, locações, recebimentos, cauções, valores, datas, configurações | **Iguais a produção** |
| Nome do inquilino | `Inquilino Teste A1B2C3` (falso) |
| CPF do inquilino | CPF falso, mas válido (a tela aceita) |
| RG, documento, telefone, número da casa, CEP | Mesmo formato, dígitos trocados |
| E-mail do inquilino | `inquilino.xxxx@exemplo.test` (falso, não recebe e-mail) |
| Rua do inquilino | `Rua de Teste` |
| Usuários do sistema (você, sua irmã, seu pai) | Mesmo **usuário** e **senha** de produção. CPF, RG, telefone e e-mail trocados — **para entrar no DEV, use o nome de usuário, não o e-mail** |
| Anexos (contratos, comprovantes) | Removidos (eles apontam para arquivos reais de produção) |
| Histórico de auditoria | Apagado (guarda cópias antigas dos dados pessoais) |

Cada registro recebe sempre o mesmo dado falso (dois resets seguidos geram
os mesmos nomes falsos).

## Proteções

1. **Trava contra troca de banco:** antes de qualquer coisa, a rotina confere
   (contra o arquivo `supabase-environments.json`) que a **origem é
   produção** e o **destino é DEV**. Se os dois estiverem trocados, iguais ou
   desconhecidos, ela para sem tocar em nenhum banco. Essa trava é testada
   sozinha em todo push (workflow "Trava de ambiente").
2. **Tudo ou nada:** todo o trabalho no DEV é feito de uma vez só. Se
   qualquer passo der erro, **o DEV volta exatamente ao que era antes**.
3. **Conferência final:** se sobrar algum e-mail real de inquilino ou de
   usuário no DEV, a rotina cancela tudo (e o DEV fica como estava).

## ⚠️ Configuração (uma vez só) — os 2 secrets

A rotina precisa do "endereço com senha" de cada banco. Isso fica guardado
no GitHub como *secret* (ninguém consegue ler depois de salvo).

### Passo 1 — pegar o endereço do banco de PRODUÇÃO

1. Entre em **supabase.com/dashboard** e abra o projeto de **PRODUÇÃO**
   (o código começa com `alvghyfb...`).
2. No topo da tela, clique no botão **Connect**.
3. Na janela que abrir, procure **Session pooler** (não use "Direct
   connection": o GitHub não consegue usar essa).
4. Copie o texto, que tem este formato:
   `postgresql://postgres.alvghyfb...:[YOUR-PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres`
5. Troque `[YOUR-PASSWORD]` (incluindo os colchetes) pela **senha do banco**
   de produção.
   - Não lembra a senha? Em **Project Settings → Database → Reset database
     password** dá para criar uma nova. O sistema não usa essa senha (ele usa
     as chaves da API), então trocar não derruba nada.
   - Se a senha tiver caracteres especiais (`@`, `#`, `/`, `:`...), prefira
     gerar uma nova só com letras e números — esses caracteres quebram o
     endereço.

### Passo 2 — pegar o endereço do banco de DEV

Mesma coisa do passo 1, mas no projeto de **DEV** (código começa com
`yrknfwei...`), com a senha do banco de DEV.

### Passo 3 — salvar os dois no GitHub

1. Abra **github.com/CaduCondo/sistemaDuvoEnterprise**.
2. **Settings** → (menu da esquerda) **Secrets and variables** → **Actions**.
3. Clique em **New repository secret**:
   - Name: `PROD_DB_URL` → Secret: o endereço do passo 1 → **Add secret**.
4. **New repository secret** de novo:
   - Name: `DEV_DB_URL` → Secret: o endereço do passo 2 → **Add secret**.

Pronto. Se os dois forem colados trocados, não tem problema: a trava percebe
e não deixa a rotina rodar (o workflow fica vermelho com a mensagem "secrets
trocados?").

## Rodar agora (sem esperar o domingo)

1. **github.com/CaduCondo/sistemaDuvoEnterprise** → aba **Actions**.
2. Na lista da esquerda, clique em **Reset do banco de DEV**.
3. Botão **Run workflow** → **Run workflow**.
4. Leva poucos minutos. No fim do log aparece quantos imóveis, inquilinos,
   locações, recebimentos e usuários foram copiados.

## Cuidados

- **Os testes automáticos usam o DEV.** Se um push acontecer exatamente
  durante o reset, os testes daquele push podem falhar. É só rodar de novo.
  (Por isso o horário automático é domingo de madrugada.)
- **Tudo o que existia só no DEV é perdido** a cada reset (dados de teste,
  tabelas criadas só lá). Mudança de banco que ainda não foi para produção
  precisa ser reaplicada no DEV depois do reset.
- **Fotos dos imóveis** continuam aparecendo: elas apontam para o Storage de
  produção, que é público (as mesmas fotos do anúncio).

## Para quem for mexer no código

Arquivos em `scripts/reset-dev/`:

| Arquivo | Papel |
|---|---|
| `guard.js` | Trava origem=PROD / destino=DEV (`--self-test` testa sem banco) |
| `reset-dev.sh` | Orquestra: `pg_dump` de PROD em 3 partes e aplica no DEV numa transação única |
| `1-limpar-dev.sql` | Esvazia o schema `public` do DEV (mantém o schema e o que é de extensões) |
| `3-anonimizar.sql` | Mascara dados pessoais, limpa anexos/auditoria e confere no fim |
| `4-zerar-permissoes.sql` | Zera permissões de anon/authenticated/service_role para reaplicar exatamente as de PROD |

Ordem dentro da transação: limpar DEV → estrutura de PROD → dados de PROD →
mascarar → índices/chaves/gatilhos/políticas de PROD → zerar permissões →
permissões de PROD → recarregar a API do Supabase.

Só o schema `public` é copiado (as tabelas do sistema). `auth`, `storage` e o
resto do Supabase do DEV não são tocados.

Testado em 30/out/2026 num Postgres local simulando PROD e DEV: troca de
estrutura, mascaramento, permissões iguais às de PROD, rodar duas vezes
seguidas, e falha no meio deixando o DEV intacto.
