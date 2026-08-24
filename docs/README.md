# 📚 Documentação do Sistema de Gestão de Locações

Índice central de toda a documentação técnica e funcional do sistema.

---

## 🎯 Visão Geral

Sistema completo de gestão de locações de imóveis com controle de pagamentos, cauções, comissões e relatórios financeiros.

**Tecnologias:** Next.js 15.5 (Page Router) + React 18 + TypeScript + Supabase + Tailwind CSS

---

## 🆕 Últimas Atualizações (2026-08-12)

- Limpeza geral do projeto: removidos arquivos e código não usados (pasta `uploads/` antiga, rota de upload local, resíduos do Softgen.ai).
- Documentação revisada: `BUSINESS_RULES.md` (duplicata em inglês) e `SETUP_SIMPLES.md` removidos por estarem desatualizados; este índice corrigido.
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

**Features implementadas:**
1. **1-autenticacao.feature** - Testes de login, logout e sessões
2. **2-permissoes-admin.feature** - Permissões do perfil Admin
3. **3-permissoes-financeiro.feature** - Permissões do perfil Financial
4. **4-permissoes-gestao.feature** - Permissões do perfil Broker
5. **5-imoveis-crud.feature** - CRUD de imóveis
6. **6-inquilinos-crud.feature** - CRUD de inquilinos
7. **7-locacoes-regras.feature** - Criação de locações e regras
8. **8-pagamentos-calculos.feature** - Cálculos de pagamentos
9. **9-regressao-visual.feature** - Testes visuais
10. **10-caucoes.feature** - Sistema de cauções
11. **11-anuncio-publico.feature** - Anúncio público aberto sem login
0. **0-smoke.feature** - Fundação da esteira (aplicação no ar, tela abre, login entra)

**O que roda sozinho a cada push:** só os cenários marcados com `@smoke`,
pelo workflow `Smoke Test` (~2 min). A suíte completa continua no
repositório, mas virou **manual** — ela falhava em todos os pushes e levava
60 minutos, o que não dizia nada a ninguém. A volta é por partes: marcar
mais cenários com `@smoke`. Ver [e2e/SMOKE.md](../e2e/SMOKE.md).

**Executar testes:**
```bash
# A suíte rápida: sobe a aplicação compilada e roda os cenários @smoke
npm run test:smoke

# Só os cenários @smoke, com a aplicação já rodando em outra janela
npm run test:bdd:smoke

# A suíte BDD completa
npm run test:bdd

# A suíte Playwright completa
npm run test:e2e
```

**Documentação de testes:**
- [e2e/SMOKE.md](../e2e/SMOKE.md) - **Comece por aqui**: como a suíte rápida funciona e como religar a antiga
- [docs/GITHUB_ACTIONS_TESTES.md](./GITHUB_ACTIONS_TESTES.md) - Os workflows do GitHub Actions
- [e2e/README.md](../e2e/README.md) - Guia geral de testes E2E
- [e2e/COMANDOS.md](../e2e/COMANDOS.md) - Comandos úteis
- [e2e/SETUP_SIMPLES.md](../e2e/SETUP_SIMPLES.md) - Setup simplificado

> Nota: há seis guias de teste em `e2e/` com conteúdo sobreposto
> (README, GUIA_RAPIDO, GUIA_TESTES_LOCAL, COMANDOS, SETUP_SIMPLES,
> EXECUTAR_TESTES_CI). Consolidar isso está no backlog; enquanto não
> acontece, `e2e/SMOKE.md` é a fonte mais atual.

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

**Última atualização:** 2026-08-12  
**Versão:** 2.3

**Mudanças recentes:**
- Limpeza do projeto: remoção de arquivos não usados e resíduos do Softgen.ai
- Documentação simplificada e desduplicada (removidos `BUSINESS_RULES.md` e `SETUP_SIMPLES.md`)
- Correções nos anexos de locações (visualização, download, arquivos antigos perdidos)
- Sistema de alertas centralizados implementado
- Reativação de locações encerradas com recriação de pagamentos
- Funções SQL com verificação de persistência (update_tenant_guaranteed, manual_update_tenant)
- Sistema de cauções documentado (deposit_installments), com testes E2E (18 cenários)

---

**Sistema desenvolvido com ❤️ usando Next.js + Supabase**