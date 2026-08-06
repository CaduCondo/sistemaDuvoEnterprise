# 📚 Documentação do Sistema de Gestão de Locações

Índice central de toda a documentação técnica e funcional do sistema.

---

## 🎯 Visão Geral

Sistema completo de gestão de locações de imóveis com controle de pagamentos, cauções, comissões e relatórios financeiros.

**Tecnologias:** Next.js 15.5 (Page Router) + React 18 + TypeScript + Supabase + Tailwind CSS

---

## 🆕 Últimas Atualizações (2026-08-06)

### Sistema de Alertas Centralizados
- ✅ Todos os alertas agora aparecem no meio da tela (não mais no rodapé)
- ✅ AlertContext implementado para gerenciamento global
- ✅ Migração completa dos componentes principais

### Reativação de Locações Encerradas
- ✅ Editar data fim de locação encerrada reativa automaticamente o contrato
- ✅ Recria pagamentos faltantes até a nova data fim
- ✅ Ajusta último pagamento anterior (de proporcional para valor cheio)
- ✅ Calcula novo último pagamento proporcional baseado na nova data

### Funções SQL Avançadas
- ✅ `update_tenant_guaranteed()` - Atualização com verificação campo por campo
- ✅ `manual_update_tenant()` - Função SQL para testes manuais
- ✅ Verificação de persistência de dados antes de retornar sucesso
- ✅ Garantia de integridade em operações críticas

---

## 📖 Documentação Principal

### 1. [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md) 🇧🇷
**Idioma:** Português  
**Conteúdo:** Documentação completa em português com todas as regras de negócio, fluxos e funcionalidades do sistema.

**Tópicos principais:**
- Autenticação e permissões
- Dashboard e métricas
- Gestão de locais, imóveis e inquilinos
- Locações e rescisões
- Pagamentos e cauções
- Financeiro e relatórios
- Workflows completos
- **NOVO:** Sistema de alertas centralizados
- **NOVO:** Reativação de locações encerradas
- **NOVO:** Funções SQL com verificação

---

### 2. [BUSINESS_RULES.md](./BUSINESS_RULES.md) 🇬🇧
**Idioma:** Inglês  
**Conteúdo:** Business rules em inglês para desenvolvedores internacionais.

**Tópicos principais:**
- Properties management
- Tenants management
- Rentals and terminations
- Security deposits (Cauções)
- Payments and receipts
- Late fees and interest
- Administrative fees
- Broker commissions
- Permissions and security
- **NEW:** Centralized alert system
- **NEW:** Rental reactivation logic
- **NEW:** SQL functions with verification

---

### 3. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
**Idioma:** Inglês  
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

### 4. [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
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
- **NEW:** AlertContext API
- **NEW:** Funções SQL de atualização com verificação

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

### [MULTI_TENANT_URLS.md](./MULTI_TENANT_URLS.md)
Análise e implementação de URLs multi-tenant para página pública de imóveis.

### [ANALISE_GATEWAY_PAGAMENTO.md](./ANALISE_GATEWAY_PAGAMENTO.md)
Análise de integração com gateways de pagamento (Stripe, Mercado Pago, etc.).

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
10. **10-caucoes.feature** - Sistema de cauções (18 cenários)

**Executar testes:**
```bash
# Todos os testes
npm run test:e2e

# Testes específicos
npm run test:e2e -- --grep "Cauções"

# Modo headless
npm run test:e2e:ci
```

**Documentação de testes:**
- [e2e/README.md](../e2e/README.md) - Guia completo de testes E2E
- [e2e/GUIA_RAPIDO.md](../e2e/GUIA_RAPIDO.md) - Guia rápido
- [e2e/COMANDOS.md](../e2e/COMANDOS.md) - Comandos úteis
- [e2e/SETUP_SIMPLES.md](../e2e/SETUP_SIMPLES.md) - Setup simplificado

---

## 🚀 Quick Start

### 1. Configurar Ambiente Local

```bash
# Clonar repositório
git clone <repo-url>
cd gerenciador-locacoes

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
📁 gerenciador-locacoes/
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
| Regras de negócio (PT) | [REGRAS_DE_NEGOCIO.md](./REGRAS_DE_NEGOCIO.md) |
| Business rules (EN) | [BUSINESS_RULES.md](./BUSINESS_RULES.md) |
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

**Última atualização:** 2026-08-06  
**Versão:** 2.2

**Mudanças recentes:**
- ✅ Sistema de alertas centralizados implementado
- ✅ Reativação de locações encerradas com recriação de pagamentos
- ✅ Funções SQL com verificação de persistência (update_tenant_guaranteed)
- ✅ Função SQL para testes manuais (manual_update_tenant)
- ✅ Sistema de cauções documentado (deposit_installments)
- ✅ Edição inline de comissões e valores
- ✅ Campo returned_deposit_amount para contratos cancelados
- ✅ Testes E2E completos para cauções (18 cenários)
- ✅ Integração com IGPM para correção de caução

---

**Sistema desenvolvido com ❤️ usando Next.js + Supabase**