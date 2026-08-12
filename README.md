# 🏢 Sistema de Gerenciamento de Locações de Imóveis

Sistema completo para gestão de locações de imóveis com controle financeiro, pagamentos, inquilinos e propriedades.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Latest-green?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwind-css)
![E2E Tests](https://github.com/CaduCondo/sistemaDuvoEnterprise/workflows/E2E%20Tests/badge.svg)

---

## 💻 Fluxo de desenvolvimento

Desenvolvimento é feito localmente (VS Code + Claude Code), com push direto para o GitHub. O Vercel publica automaticamente em produção a cada push na branch `main` — não há mais etapa de sincronização manual.

👉 Veja [SETUP_AMBIENTE_LOCAL.md](./SETUP_AMBIENTE_LOCAL.md) para configurar o ambiente local.

---

## 🧪 Testes Automatizados (GitHub Actions)

**Testes E2E rodam AUTOMATICAMENTE em cada push/PR:**

```bash
git push origin main  →  Testes rodam automaticamente ✅
```

**Ou rode manualmente:**
```
Actions → E2E Tests → Run workflow
```

📚 **[Guia Completo de Testes no GitHub Actions](./docs/GITHUB_ACTIONS_TESTES.md)**

**Configuração necessária:**
- 3 secrets do Supabase (Settings → Secrets)
- Instruções completas no guia

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Documentação Adicional](#-documentação-adicional)
- [Licença](#-licença)

---

## 🎯 Visão Geral

Sistema desenvolvido em **Next.js 15** com **TypeScript** e **Supabase** para gerenciar:

- 🏠 **Propriedades**: Cadastro completo de imóveis com fotos, documentos e informações detalhadas
- 👥 **Inquilinos**: Gestão de locatários com documentos e histórico
- 📝 **Locações**: Contratos de aluguel com geração automática de recebimentos
- 💰 **Recebimentos**: Controle financeiro completo com parcelas, multas, juros e caução
- 📊 **Dashboard**: Visão financeira em tempo real com gráficos e métricas
- 🔐 **Multi-tenant**: Sistema de permissões por localização e perfis de usuário
- 📄 **Relatórios**: Geração de contratos, recibos e extratos em PDF

---

## ✨ Funcionalidades

### 🔐 Autenticação e Segurança
- ✅ Login via dropdown no header público (sem página de login separada)
- ✅ Sistema de 3 tentativas com bloqueio automático (30 minutos)
- ✅ Senha temporária gerada automaticamente (12 caracteres)
- ✅ Troca de senha obrigatória no primeiro acesso
- ✅ Validação visual em tempo real das regras de senha
- ✅ Recuperação de senha via email
- ✅ Sistema de tema claro/escuro por usuário
- ✅ Tema persistente entre dispositivos

### 👥 Gestão de Usuários
- ✅ Criação simplificada com geração automática de senha
- ✅ Email de boas-vindas automático
- ✅ Campo único "E-mail / Usuário"
- ✅ Validação de email (deve conter @)
- ✅ Validação de telefone com máscara brasileira
- ✅ Status Ativo/Inativo com bolinha colorida
- ✅ Reset de senha com envio de email
- ✅ Edição inline (clicar na linha da tabela)
- ✅ Ícones diretos de ação (sem dropdown)

### 🏠 Gestão de Propriedades
- ✅ Cadastro completo com múltiplas fotos
- ✅ Gestão de documentos (IPTU, matrícula, etc.)
- ✅ Controle de status (disponível, ocupado, manutenção)
- ✅ Filtros avançados por localização, tipo, valor
- ✅ Visualização pública para divulgação

### 👥 Gestão de Inquilinos
- ✅ Cadastro com documentos pessoais
- ✅ Campos adicionais: Profissão, Estado Civil, Renda Mensal
- ✅ Histórico de locações
- ✅ Controle de inadimplência
- ✅ Dados de contato e emergência
- ✅ Função SQL de atualização com verificação de persistência

### 📝 Gestão de Locações
- ✅ Criação de contratos com cálculo automático
- ✅ Geração automática de recebimentos mensais
- ✅ Caução com parcelamento e correção por IGPM
- ✅ Vaga de garagem opcional
- ✅ Corretor parceiro (comissão)
- ✅ Rescisão de contrato com cálculo proporcional
- ✅ Renovação de contratos
- ✅ Reativação de locações encerradas com recriação de pagamentos

### 💰 Gestão Financeira
- ✅ Controle de recebimentos com status (pago, pendente, atrasado)
- ✅ Cálculo automático de multa e juros
- ✅ Gestão de caução (parcelado ou à vista)
- ✅ Comissão de corretor
- ✅ Despesas de localização
- ✅ Isenção de taxa administrativa
- ✅ Geração de recibos em PDF
- ✅ Alertas centralizados (exibidos no meio da tela)

### 📊 Dashboard e Relatórios
- ✅ Visão financeira em tempo real
- ✅ Gráficos de recebimentos e inadimplência
- ✅ Métricas de ocupação e vacância
- ✅ Alertas de vencimento de contratos
- ✅ Exportação de dados

### 🔐 Segurança e Permissões
- ✅ Autenticação com Supabase Auth
- ✅ Sistema de perfis (Admin, Gerente, Operador, Visualizador)
- ✅ Permissões por localização
- ✅ Row Level Security (RLS) no banco de dados
- ✅ Logs de auditoria
- ✅ Funções SQL com verificação de persistência de dados

---

## 🛠️ Tecnologias

### Frontend
- **Next.js 15.5** - Framework React com Pages Router
- **TypeScript 5.0** - Tipagem estática
- **Tailwind CSS 3.4** - Estilização
- **Shadcn/UI** - Biblioteca de componentes
- **Framer Motion** - Animações
- **React Hook Form** - Formulários
- **Zod** - Validação de dados

### Backend
- **Supabase** - Backend completo (Database, Auth, Storage)
- **PostgreSQL** - Banco de dados relacional
- **Row Level Security (RLS)** - Segurança em nível de linha
- **SQL Functions** - Funções personalizadas com verificação de dados

### Ferramentas
- **ESLint** - Linting de código
- **Prettier** - Formatação de código
- **PM2** - Gerenciador de processos
- **Playwright** - Testes E2E

---

## 📦 Pré-requisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Conta Supabase** (gratuita disponível em [supabase.com](https://supabase.com))

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/CaduCondo/sistemaDuvoEnterprise.git
cd sistemaDuvoEnterprise
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase

# Upload (opcional)
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

### 4. Configure o banco de dados

Execute as migrations na pasta `supabase/migrations/` no Supabase Dashboard:

1. Acesse **SQL Editor** no Supabase Dashboard
2. Execute os arquivos de migration em ordem cronológica
3. Verifique se todas as tabelas foram criadas corretamente
4. Execute as funções SQL personalizadas (update_tenant_guaranteed, manual_update_tenant)

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação.

---

## ⚙️ Configuração

### Configuração Inicial

Após a primeira execução, você precisa:

1. **Criar usuário admin** no Supabase Auth
2. **Configurar permissões** na página de Configurações
3. **Cadastrar localizações** (cidades/regiões de atuação)
4. **Definir taxas administrativas** por localização
5. **Configurar isenções de taxa** (se necessário)

### Configurações Importantes

#### Taxa Administrativa
- Percentual padrão: **10%** (configurável por localização)
- Aplicada sobre o valor do aluguel
- Pode ser isenta para inquilinos específicos

#### Multa e Juros
- **Multa**: 2% sobre o valor após 1º dia de atraso
- **Juros**: 1% ao mês (0,033% ao dia)
- Cálculo automático baseado na data de vencimento

#### Caução
- Pode ser parcelado em até **3 vezes**
- Correção automática por **IGPM** na rescisão
- Devolução automática no último mês

#### Vaga de Garagem
- Valor adicional opcional
- Não sofre taxa administrativa

---

## 📁 Estrutura do Projeto

```
sistemaDuvoEnterprise/
├── src/
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes base (shadcn/ui)
│   │   ├── dashboard/     # Componentes do dashboard
│   │   ├── properties/    # Componentes de propriedades
│   │   ├── tenants/       # Componentes de inquilinos
│   │   ├── rentals/       # Componentes de locações
│   │   ├── payments/      # Componentes de pagamentos
│   │   ├── financial/     # Componentes financeiros
│   │   └── settings/      # Componentes de configurações
│   ├── contexts/          # Contextos React (Auth, Theme, Alert)
│   ├── hooks/             # Custom hooks
│   ├── integrations/      # Integrações (Supabase)
│   ├── lib/               # Utilitários e helpers
│   ├── pages/             # Páginas Next.js (Pages Router)
│   │   ├── api/          # API Routes
│   │   ├── dashboard/    # Dashboard
│   │   ├── properties/   # Gestão de propriedades
│   │   ├── tenants/      # Gestão de inquilinos
│   │   ├── rentals/      # Gestão de locações
│   │   └── payments/     # Gestão de pagamentos
│   ├── services/          # Serviços de API (backend)
│   ├── styles/            # Estilos globais
│   └── types/             # Definições de tipos TypeScript
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # SQL migrations
├── public/                # Arquivos estáticos
├── docs/                  # Documentação
└── e2e/                   # Testes E2E (Playwright)
```

---

## 📜 Scripts Disponíveis

### Desenvolvimento

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Inicia servidor de produção
npm run lint         # Verifica código com ESLint
```

### Banco de Dados

```bash
# Gerar tipos TypeScript do banco
npm run supabase:generate-types
```

### Testes

```bash
npm run test:e2e     # Executa testes E2E
npm run test:e2e:ci  # Testes E2E em modo headless
```

### Produção

```bash
npm run build        # Build otimizado
npm run start        # Servidor de produção
```

---

## 📚 Documentação Adicional

- [**Índice completo da documentação**](docs/README.md) - ponto de partida para toda a documentação técnica
- [**Arquitetura**](docs/ARCHITECTURE.md) - Estrutura técnica e fluxo de dados
- [**Regras de Negócio**](docs/REGRAS_DE_NEGOCIO.md) - Regras detalhadas do sistema
- [**API**](docs/API_DOCUMENTATION.md) - Documentação completa das APIs
- [**Banco de Dados**](docs/DATABASE_SCHEMA.md) - Esquema e relacionamentos
- [**Deploy**](docs/DEPLOYMENT.md) - Guia de deployment
- [**Contribuindo**](docs/CONTRIBUTING.md) - Guia para desenvolvedores

---

## 🔐 Segurança

- ✅ **Sistema de 3 tentativas** com bloqueio automático
- ✅ **Senha temporária** com troca obrigatória
- ✅ **Row Level Security (RLS)** habilitado em todas as tabelas
- ✅ **Autenticação JWT** via Supabase Auth
- ✅ **Permissões granulares** por perfil e localização
- ✅ **Validação de dados** com Zod em todas as entradas
- ✅ **HTTPS obrigatório** em produção
- ✅ **Sanitização de uploads** de arquivos
- ✅ **Bloqueio temporário** após múltiplas tentativas falhas
- ✅ **Emails de notificação** para ações críticas
- ✅ **Funções SQL** com verificação de persistência de dados

---

## 🆕 Novidades (2026-08-12)

- Projeto limpo: removidos arquivos não usados e resíduos do antigo Softgen.ai
- Documentação revisada e desduplicada
- Correções nos anexos de locações (visualização, download, arquivos antigos perdidos)
- Sistema de alertas centralizados (exibidos no meio da tela)
- Reativação automática de locações encerradas ao editar a data fim

---

## 🐛 Problemas Conhecidos

O acompanhamento de bugs e próximas melhorias é feito pelo kanban do projeto: https://duvoenterprise.com.br/kanban

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](docs/CONTRIBUTING.md) para detalhes.

---

## 📄 Licença

Este projeto é privado e proprietário. Todos os direitos reservados.

---

## 📞 Suporte

Para dúvidas ou suporte, veja a [documentação](docs/README.md) ou o [kanban do projeto](https://duvoenterprise.com.br/kanban).

---

## 🎉 Agradecimentos

Desenvolvido com ❤️ usando:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/UI](https://ui.shadcn.com/)

---

**Versão**: 1.2.0  
**Última atualização**: 12 de Agosto de 2026