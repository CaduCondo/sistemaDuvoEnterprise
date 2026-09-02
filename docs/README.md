# 📚 Documentação do Sistema de Gestão de Locações

Índice central de toda a documentação técnica e funcional do sistema.

---

## 🎯 Visão Geral

Sistema completo de gestão de locações de imóveis com controle de pagamentos, cauções, comissões e relatórios financeiros.

**Tecnologias:** Next.js 15.5 (Page Router) + React 18 + TypeScript + Supabase + Tailwind CSS

---

## 🆕 Últimas Atualizações (2026-09-02)

- Rescisão: aviso quando a locação tem parcela de caução pendente/parcial ao confirmar a rescisão, com cancelamento automático das parcelas nunca pagas (01/set/2026) — ver "Aviso quando a caução está pendente ou parcial" em `REGRAS_DE_NEGOCIO.md`.
- Cadastro de usuários, troca de senha e bloqueio por tentativas erradas voltaram a funcionar em produção (estavam travados em silêncio por uma regra de segurança do banco/RLS que exigia login do Supabase, que este sistema não usa) — corrigido movendo essas operações para rotas do servidor.
- Dois bugs antigos do parcelamento do caução (edição não sincronizava o número de parcelas; criação de locação nova só salvava a 1ª parcela) corrigidos e em produção — issues [#13](https://github.com/CaduCondo/sistemaDuvoEnterprise/issues/13) e [#14](https://github.com/CaduCondo/sistemaDuvoEnterprise/issues/14).
- E-mail de recuperação de senha: correção de um defeito que travava o teste automático quando a chave do serviço de e-mail (Resend) não estava configurada.

## 🆕 Atualizações anteriores (2026-08-31)

- Rescisão de contrato separada da devolução do caução (#49) em produção e estável — ver seção "🔚 Rescisão de Contrato" em `REGRAS_DE_NEGOCIO.md`.
- Testes BDD reorganizados em duas rodadas automáticas: `@smoke` (rápida, ~12 cenários críticos) e `@sistemaCompleto` (todo o resto, roda depois). Ver [e2e/SMOKE.md](../e2e/SMOKE.md).
- Correção: clicar "OK" na mensagem de sucesso travava a tela inteira (commit `e386d423`).
- Login passou a ser validado no servidor, não mais só no navegador (etapa 1).

> ⚠️ Nota (31/ago/2026): as atualizações de 12/ago/2026 abaixo diziam que
> `e2e/SETUP_SIMPLES.md` tinha sido removido — não foi (o arquivo ainda
> existe, hoje como um redirecionamento curto para `e2e/GUIA_RAPIDO.md`).
> `BUSINESS_RULES.md` esse sim não existe mais no repositório.

- Limpeza geral do projeto (12/ago/2026): removidos arquivos e código não usados (pasta `uploads/` antiga, rota de upload local, resíduos do Softgen.ai).
- Documentação revisada (12/ago/2026): `BUSINESS_RULES.md` (duplicata em inglês) removido por estar desatualizado; este índice corrigido.
- Anexos: correção de bugs de exibição/download e tratamento amigável para arquivos antigos perdidos.
- Sistema de alertas centralizado (aparecem no meio da tela) e reativação automática de locações encerradas ao editar a data fim.

---

## 📖 Documentação Principal

### 1. [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md)
**Idioma:** Português  
**Conteúdo:** Documentação completa em português com todas as regras de negócio, fluxos e funcionalidades do sistema. Documento único e canônico — a versão em inglês (`BUSINESS_RULES.md`) foi removida em agosto/2026 por ser uma tradução duplicada e desatualizada, dando trabalho extra de manutenção sem necessidade (não há equipe internacional usando este projeto).

**Tópicos principais:**
- Autenticação e permissões
- Dashboard e métricas
- Gestão de locais, imóveis e inquilinos
- Locações e rescisões
- Pagamentos e cauções
- Financeiro e relatórios
- Workflows completos
- Sistema de alertas centralizados
- Reativação de locações encerradas
- Funções SQL com verificação

---

### 2. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
**Idioma:** Português  
**Conteúdo:** Esquema completo do banco de dados PostgreSQL com diagramas ER, tabelas, relacionamentos, índices e triggers.

**Tópicos principais:**
- Diagrama ER
- Estrutura de todas as tabelas
- Relacionamentos (Foreign Keys)
- Índices para performance
- Triggers automáticos
- Row Level Security (RLS)
- Políticas de acesso
- Views úteis
- Consultas SQL comuns
- **NEW:** Funções SQL personalizadas (update_tenant_guaranteed, manual_update_tenant)

---

### 3. [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
**Idioma:** Inglês  
**Conteúdo:** Documentação completa de todos os serviços, APIs e integrações.

**Tópicos principais:**
- Arquitetura de serviços
- Autenticação (authService)
- Serviços de propriedades (propertyService)
- Serviços de inquilinos (tenantService)
- Serviços de locações (rentalService)
- Serviços de pagamentos (paymentService)
- Serviços de cauções (depositInstallmentService)
- API Routes do Next.js
- Integrações externas (IGPM)
- Tipos TypeScript completos
- Exemplos de uso
- AlertContext API
- Funções SQL de atualização com verificação

---

## 📋 Documentação Adicional

### [ARCHITECTURE.md](./ARCHITECTURE.md)
Arquitetura do sistema, padrões de código, estrutura de pastas e decisões técnicas.

### [DEPLOYMENT.md](./DEPLOYMENT.md)
Guia completo de deploy em produção (Vercel + Supabase).

### [CONTRIBUTING.md](./CONTRIBUTING.md)
Guia para contribuidores: como configurar ambiente local, padrões de commit, pull requests.

### [RLS_POLICIES_GUIDE.md](./RLS_POLICIES_GUIDE.md)
Guia detalhado das políticas de Row Level Security implementadas no Supabase.

### [MULTI_TENANT_URLS.md](./MULTI_TENANT_URLS.md) 📌 documento de planejamento
Proposta de URLs multi-tenant para página pública de imóveis — ainda não implementada.

### [ANALISE_GATEWAY_PAGAMENTO.md](./ANALISE_GATEWAY_PAGAMENTO.md) 📌 documento de planejamento
Análise de viabilidade para integrar um gateway de pagamento (Asaas) — ainda não implementada.

---

## 🧪 Testes

### Testes E2E (Playwright + Cucumber)

**Localização:** `e2e/`

**Features implementadas** (cada arquivo carrega uma tag de página — ver [e2e/SMOKE.md](../e2e/SMOKE.md)):
0. **0-smoke.feature** `@fundacao` - Fundação da esteira (aplicação no ar, tela abre, login entra)
1. **1-autenticacao.feature** `@autenticacao` - Login, logout e sessões
2. **2-permissoes-admin.feature** `@permissoesAdmin` - Permissões do perfil Admin
3. **3-permissoes-financeiro.feature** `@permissoesFinanceiro` - Permissões do perfil Financeiro
4. **4-permissoes-gestao.feature** `@permissoesGestao` - Permissões do perfil Gestão
5. **5-imoveis-crud.feature** `@imoveis` - CRUD de imóveis
6. **6-inquilinos-crud.feature** `@inquilinos` - CRUD de inquilinos
7. **7-locacoes-regras.feature** `@locacoes` - Criação de locações e regras
8. **8-pagamentos-calculos.feature** `@pagamentos` - Cálculos de pagamentos
9. **9-regressao-visual.feature** `@regressaoVisual` - Testes visuais
10. **10-caucoes.feature** `@caucoes` - Sistema de cauções
11. **11-anuncio-publico.feature** `@anuncioPublico` - Anúncio público aberto sem login
12. **12-rescisao-caucao.feature** `@rescisao` - Rescisão de contrato separada da devolução do caução (#49)

**O que roda sozinho a cada push:** duas rodadas sequenciais, pelo workflow
`Smoke Test` (`.github/workflows/smoke.yml`). Rodada 1 — cenários marcados
`@smoke` (~2-5 min, o "pode seguir" rápido). Rodada 2 — só começa depois que
a 1 passa, roda todos os cenários marcados `@sistemaCompleto` (o resto de
todas as regras de negócio, ~15-25 min). Nenhum cenário roda nas duas.
Ver [e2e/SMOKE.md](../e2e/SMOKE.md) para o esquema completo de tags
(inclusive as tags de página, uma por tela).

**Executar testes:**
```bash
# Rodada 1: sobe a aplicação compilada e roda os cenários @smoke
npm run test:smoke

# Rodada 2: sobe a aplicação compilada e roda os cenários @sistemaCompleto
npm run test:completo

# Só os cenários @smoke, com a aplicação já rodando em outra janela
npm run test:bdd:smoke

# Só os cenários @sistemaCompleto, com a aplicação já rodando
npm run test:bdd:sistemaCompleto

# A suíte BDD inteira (as duas rodadas juntas)
npm run test:bdd

# A suíte Playwright completa (permissões, segurança, performance, stress)
npm run test:e2e
```

**Documentação de testes:**
- [e2e/SMOKE.md](../e2e/SMOKE.md) - **Comece por aqui**: as duas rodadas, o esquema completo de tags e o histórico
- [docs/GITHUB_ACTIONS_TESTES.md](./GITHUB_ACTIONS_TESTES.md) - Os workflows do GitHub Actions
- [e2e/README.md](../e2e/README.md) - Guia geral de testes E2E
- [e2e/COMANDOS.md](../e2e/COMANDOS.md) - Comandos úteis

---

## 🚀 Quick Start

### 1. Configurar Ambiente Local

```bash
# Clonar repositório
git clone https://github.com/CaduCondo/sistemaDuvoEnterprise.git
cd sistemaDuvoEnterprise

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local.example .env.local
# Editar .env.local com credenciais do Supabase

# Executar em desenvolvimento
npm run dev
```

### 2. Estrutura do Projeto

```
📁 sistemaDuvoEnterprise/
├── 📁 src/
│   ├── 📁 components/      # Componentes React
│   ├── 📁 pages/           # Páginas Next.js (Page Router)
│   ├── 📁 services/        # Serviços de API
│   ├── 📁 hooks/           # Custom hooks
│   ├── 📁 contexts/        # Context providers (Auth, Theme, Alert)
│   ├── 📁 lib/             # Utilitários
│   ├── 📁 types/           # Tipos TypeScript
│   └── 📁 styles/          # Estilos globais
├── 📁 docs/                # 📚 Documentação (VOCÊ ESTÁ AQUI)
├── 📁 e2e/                 # Testes E2E
├── 📁 supabase/            # Migrações e Edge Functions
└── 📁 public/              # Arquivos estáticos
```

---

## 🔍 Buscar Informação

**Procurando por algo específico?**

| Preciso saber sobre... | Consultar |
|------------------------|-----------|
| Regras de negócio | [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md) |
| Estrutura do banco | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |
| Como usar os serviços | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) |
| Políticas RLS | [RLS_POLICIES_GUIDE.md](./RLS_POLICIES_GUIDE.md) |
| Deploy em produção | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Contribuir código | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Executar testes | [e2e/README.md](../e2e/README.md) |
| Sistema de alertas | [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md) |
| Reativação de locações | [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md) |
| Funções SQL | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |

---

## 🆘 Suporte

**Dúvidas ou problemas?**

1. Consulte a documentação relevante acima
2. Verifique os exemplos de código em [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
3. Revise os testes E2E para ver casos de uso reais
4. Abra uma issue no repositório

---

## 📝 Notas de Atualização

**Última atualização:** 2026-09-02
**Versão:** 2.4.4 (ver `package.json`)

**Mudanças recentes:**
- Aviso de caução pendente/parcial ao confirmar rescisão, com cancelamento automático das parcelas nunca pagas
- Cadastro/edição de usuários, troca de senha e bloqueio por tentativas voltaram a funcionar em produção (RLS)
- Dois bugs do parcelamento do caução corrigidos (edição e criação de locação) — issues #13 e #14
- Rescisão de contrato separada da devolução do caução (#49) em produção
- Testes BDD em duas rodadas automáticas por push: `@smoke` (~12 cenários) e `@sistemaCompleto` (o resto)
- Documentação simplificada e desduplicada (removido `BUSINESS_RULES.md`)
- Correções nos anexos de locações (visualização, download, arquivos antigos perdidos)
- Sistema de alertas centralizados implementado
- Reativação de locações encerradas com recriação de pagamentos
- Funções SQL com verificação de persistência (update_tenant_guaranteed, manual_update_tenant)
- Sistema de cauções documentado (deposit_installments)

---

**Sistema desenvolvido com ❤️ usando Next.js + Supabase**