# 🌐 Estratégias de URLs Multi-Tenant para Páginas Públicas

> 📌 **Status: documento de planejamento — nada disso foi implementado.**
> É uma análise de opções para o futuro, não uma descrição do sistema atual
> (hoje não existe conceito de multi-tenant/organização no código nem no banco).

**Data:** 08/07/2026  
**Sistema:** Gerenciador de Locações de Imóveis  
**Objetivo:** Cada imobiliária ter sua própria página pública de anúncios

---

## 📊 Análise da Estrutura Atual

### Páginas Públicas Existentes
```
/ (index.tsx)               → Listagem de todos os imóveis disponíveis
/imovel/[id]               → Detalhes de um imóvel específico
```

### Configurações Atuais (Hardcoded)
```typescript
// src/services/configService.ts
export const siteConfig = {
  name: "D'Uvo Enterprise",
  contact: {
    phone: "(11) 99680-3386",
    whatsapp: "5511996803386",
    email: "carlos.uva@terra.com.br",
    address: "São Paulo, SP",
  }
};
```

### Componentes Reutilizáveis
- ✅ `PublicHeader` → Já mostra nome da empresa
- ✅ `PropertyPublicCard` → Cards de imóveis
- ✅ `InterestFormDialog` → Formulário de interesse
- ✅ `WhatsAppButton` → Botão flutuante

**Conclusão:** A estrutura está 80% pronta! Só falta implementar o roteamento multi-tenant.

---

## 🎯 3 Estratégias de URL Multi-Tenant

### 1. **Subdomínios** ⭐ MAIS PROFISSIONAL
```
imobiliaria-abc.seusite.com.br     → Página da Imobiliária ABC
imobiliaria-xyz.seusite.com.br     → Página da Imobiliária XYZ
duvo-enterprise.seusite.com.br     → Sua página atual
```

**Como funciona:**
- Cada imobiliária tem um subdomínio exclusivo
- Usuário acessa o subdomínio
- Sistema detecta qual organização pelo subdomínio
- Mostra apenas os imóveis daquela organização

**Prós:**
- ✅ MUITO profissional (parece site próprio)
- ✅ SEO independente por imobiliária
- ✅ Pode personalizar tudo (logo, cores, textos)
- ✅ Ideal para white-label

**Contras:**
- ⚠️ Requer configuração de DNS (não é difícil)
- ⚠️ Custo de certificado SSL (Let's Encrypt é grátis)
- ⚠️ Complexidade média de implementação

**Complexidade:** 🟡 Média  
**Custo:** R$ 0 (DNS + SSL grátis)  
**Tempo:** 1-2 semanas

---

### 2. **Path-based (Slug)** ⭐ MAIS SIMPLES
```
seusite.com.br/imobiliaria-abc     → Página da Imobiliária ABC
seusite.com.br/imobiliaria-xyz     → Página da Imobiliária XYZ
seusite.com.br/duvo-enterprise     → Sua página atual
```

**Como funciona:**
- Cada imobiliária tem um "slug" único (URL amigável)
- Usuário acessa seusite.com.br/[slug]
- Sistema detecta qual organização pelo slug na URL
- Mostra apenas os imóveis daquela organização

**Prós:**
- ✅ MUITO fácil de implementar
- ✅ Sem configurações de DNS
- ✅ Funciona imediatamente
- ✅ Bom para MVP/teste

**Contras:**
- ⚠️ Menos profissional que subdomínio
- ⚠️ SEO compartilhado (mesmo domínio)
- ⚠️ Usuário vê que é plataforma compartilhada

**Complexidade:** 🟢 Baixa  
**Custo:** R$ 0  
**Tempo:** 3-5 dias

---

### 3. **Domínio Customizado** 🏆 MAIS PREMIUM
```
www.imobiliariabc.com.br           → Site próprio da Imobiliária ABC
www.imovelxyz.com.br               → Site próprio da Imobiliária XYZ
www.duvoenterprise.com.br          → Seu site atual
```

**Como funciona:**
- Imobiliária registra SEU PRÓPRIO domínio
- Aponta o domínio para seu servidor
- Sistema detecta qual organização pelo domínio
- Funciona como site 100% independente

**Prós:**
- ✅ EXTREMAMENTE profissional
- ✅ White-label total (cliente não sabe que usa sua plataforma)
- ✅ SEO totalmente independente
- ✅ Cliente pode fazer marketing com domínio próprio

**Contras:**
- ⚠️ Requer implementação de wildcard SSL
- ⚠️ Cliente precisa comprar domínio próprio
- ⚠️ Complexidade alta de DNS

**Complexidade:** 🔴 Alta  
**Custo:** R$ 40-60/ano por cliente (domínio próprio)  
**Tempo:** 2-3 semanas

---

## 💡 Minha Recomendação: Híbrido

**Fase 1 (MVP - 1 semana):**
- Usar **Path-based (Slug)** para começar rápido
- Validar o modelo com 3-5 clientes beta
- Exemplo: `seusite.com.br/imobiliaria-abc`

**Fase 2 (Produção - 2 semanas):**
- Implementar **Subdomínios** para clientes pagos
- Exemplo: `imobiliaria-abc.seusite.com.br`
- Melhor custo-benefício profissionalismo vs complexidade

**Fase 3 (Premium - opcional):**
- Oferecer **Domínio Customizado** como plano Enterprise
- Exemplo: `www.imobiliariabc.com.br`
- Cobrar R$ 50-100/mês extra

---

## 🏗️ Implementação: Path-based (Slug) - MVP

### Mudanças Necessárias no Banco de Dados

#### 1. Adicionar `slug` à tabela `organizations`
```sql
ALTER TABLE organizations ADD COLUMN slug TEXT UNIQUE NOT NULL DEFAULT '';
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Exemplo de slugs
-- 'duvo-enterprise'
-- 'imobiliaria-abc'
-- 'imoveis-xyz'
```

#### 2. Adicionar `organization_id` em `properties`
```sql
-- Já vimos isso no documento anterior, mas é fundamental
ALTER TABLE properties ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_properties_org ON properties(organization_id);
```

---

### Estrutura de Rotas

#### Rota Atual (será depreciada)
```
/ → index.tsx (mostra TODOS os imóveis - seus imóveis atuais)
```

#### Nova Estrutura Multi-Tenant
```
/[slug] → Página pública da organização
  Exemplos:
  /duvo-enterprise → Seus imóveis
  /imobiliaria-abc → Imóveis da ABC
  /imoveis-xyz → Imóveis da XYZ

/[slug]/imovel/[id] → Detalhes do imóvel daquela organização
  Exemplos:
  /duvo-enterprise/imovel/123
  /imobiliaria-abc/imovel/456
```

#### Arquivo de Rotas Next.js
```typescript
// pages/[slug]/index.tsx → Listagem da organização
// pages/[slug]/imovel/[id].tsx → Detalhes do imóvel
```

---

### Código: Detectar Organização pelo Slug

#### 1. Criar Hook `useOrganizationBySlug`
```typescript
// src/hooks/useOrganizationBySlug.ts
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_address: string | null;
}

export function useOrganizationBySlug(slug: string) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      try {
        setLoading(true);
        
        const { data, error: fetchError } = await supabase
          .from("organizations")
          .select("*")
          .eq("slug", slug)
          .eq("status", "active")
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Organização não encontrada");

        setOrganization(data);
      } catch (err: any) {
        console.error("Erro ao buscar organização:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchOrganization();
    }
  }, [slug]);

  return { organization, loading, error };
}
```

#### 2. Nova Página: `pages/[slug]/index.tsx`
```typescript
// Página pública da organização (cópia adaptada de index.tsx)
import { useRouter } from "next/router";
import { useOrganizationBySlug } from "@/hooks/useOrganizationBySlug";
import { PublicHeader } from "@/components/public/PublicHeader";
import { usePublicPropertiesByOrg } from "@/hooks/usePublicPropertiesByOrg";
// ... resto dos imports

export default function OrganizationPublicPage() {
  const router = useRouter();
  const { slug } = router.query;
  
  // Buscar organização pelo slug
  const { organization, loading: orgLoading, error: orgError } = 
    useOrganizationBySlug(slug as string);
  
  // Buscar imóveis APENAS desta organização
  const { properties, loading, error } = 
    usePublicPropertiesByOrg(organization?.id);

  if (orgLoading) {
    return <div>Carregando...</div>;
  }

  if (orgError || !organization) {
    return <div>Organização não encontrada</div>;
  }

  // Usar dados da organização para personalizar
  const siteConfig = {
    name: organization.name,
    logo: organization.logo_url,
    contact: {
      phone: organization.contact_phone,
      email: organization.contact_email,
      whatsapp: organization.contact_whatsapp,
      address: organization.contact_address,
    },
  };

  return (
    <>
      <Head>
        <title>{organization.name} - Encontre seu novo lar</title>
        {/* ... resto do head personalizado */}
      </Head>

      <div className="min-h-screen">
        <PublicHeader organization={organization} />
        
        {/* Resto da página igual a index.tsx */}
        {/* MAS mostrando apenas properties desta organização */}
      </div>
    </>
  );
}
```

#### 3. Nova Página: `pages/[slug]/imovel/[id].tsx`
```typescript
// Detalhes do imóvel (cópia adaptada de imovel/[id].tsx)
export default function PropertyDetailPageByOrg() {
  const router = useRouter();
  const { slug, id } = router.query;
  
  // Buscar organização
  const { organization } = useOrganizationBySlug(slug as string);
  
  // Buscar imóvel APENAS desta organização
  const { data: property } = await supabase
    .from("properties")
    .select("...")
    .eq("id", id)
    .eq("organization_id", organization.id) // 🔥 CRÍTICO: Filtrar por org
    .single();

  // ... resto do código
}
```

---

## 🎨 Personalização por Organização

### O que pode ser personalizado:

#### 1. **Dados Básicos**
- Nome da imobiliária
- Logo (no header e footer)
- Slogan/descrição

#### 2. **Contatos**
- Telefone
- Email
- WhatsApp
- Endereço

#### 3. **Visual (opcional)**
- Cor primária (gradientes, botões)
- Cor secundária (badges, acentos)
- Fonte customizada

#### 4. **Textos**
- Mensagem do WhatsApp
- Texto do hero section
- Chamadas para ação (CTAs)

### Exemplo de Personalização
```typescript
// Imobiliária ABC
{
  name: "Imobiliária ABC Negócios",
  primaryColor: "#FF6B35", // Laranja vibrante
  heroTitle: "Seu Novo Apartamento Está Aqui!",
  whatsappMessage: "Olá! Vi um imóvel no site da ABC e gostaria de mais informações."
}

// Imobiliária XYZ
{
  name: "XYZ Imóveis Premium",
  primaryColor: "#2B7A78", // Verde água
  heroTitle: "Imóveis de Alto Padrão",
  whatsappMessage: "Olá! Tenho interesse em conhecer os imóveis disponíveis."
}
```

---

## 💰 Resumo de Custos e Tempo

### Opção 1: Path-based (MVP)
```
Desenvolvimento: R$ 3.000 - R$ 5.000
Tempo: 3-5 dias
Custo operacional: R$ 0/mês
Exemplo de URL: seusite.com.br/imobiliaria-abc
```

### Opção 2: Subdomínios (Produção)
```
Desenvolvimento: R$ 5.000 - R$ 8.000
Tempo: 1-2 semanas
Custo operacional: R$ 0/mês (SSL grátis)
Exemplo de URL: imobiliaria-abc.seusite.com.br
```

### Opção 3: Domínio Customizado (Premium)
```
Desenvolvimento: R$ 8.000 - R$ 12.000
Tempo: 2-3 semanas
Custo operacional: R$ 40-60/ano por cliente (domínio)
Exemplo de URL: www.imobiliariabc.com.br
```

---

## 🚀 Plano de Implementação Recomendado

### Fase 0: Preparação (já fizemos na análise anterior)
1. ✅ Separar banco Dev/Prod
2. ✅ Implementar Asaas (opcional, mas recomendado)

### Fase 1: Multi-tenant Básico (2 semanas)
1. ✅ Criar tabela `organizations`
2. ✅ Adicionar `organization_id` em todas as tabelas
3. ✅ Implementar RLS policies
4. ✅ Criar sistema de onboarding

### Fase 2: URLs Multi-tenant (1 semana)
1. ✅ Adicionar campo `slug` em `organizations`
2. ✅ Criar hook `useOrganizationBySlug`
3. ✅ Criar páginas `[slug]/index.tsx` e `[slug]/imovel/[id].tsx`
4. ✅ Adaptar componentes públicos para receber `organization`
5. ✅ Testar com 2-3 organizações

### Fase 3: Personalização (1 semana)
1. ✅ Adicionar campos de customização em `organizations`
2. ✅ Implementar upload de logo
3. ✅ Sistema de cores customizadas
4. ✅ Mensagens personalizadas

**TOTAL: 4 semanas (1 mês)**

---

## ✅ Exemplo Prático: Como Ficaria

### Sua Imobiliária Atual (D'Uvo Enterprise)
```
URL: seusite.com.br/duvo-enterprise
  ou: duvo-enterprise.seusite.com.br (com subdomínio)

Imóveis mostrados:
- ✅ Seus 89 contratos ativos
- ❌ Imóveis de outras imobiliárias NÃO aparecem

Header:
- Logo: D'Uvo Enterprise
- Telefone: (11) 99680-3386
- Email: carlos.uva@terra.com.br
```

### Cliente Novo: Imobiliária ABC
```
URL: seusite.com.br/imobiliaria-abc
  ou: imobiliaria-abc.seusite.com.br (com subdomínio)

Imóveis mostrados:
- ✅ Apenas os 23 imóveis da ABC
- ❌ Seus imóveis NÃO aparecem
- ❌ Imóveis de outras imobiliárias NÃO aparecem

Header:
- Logo: Imobiliária ABC (próprio)
- Telefone: (11) 98765-4321 (deles)
- Email: contato@imobiliariabc.com.br (deles)
```

### Cliente Novo: XYZ Imóveis
```
URL: seusite.com.br/imoveis-xyz
  ou: imoveis-xyz.seusite.com.br (com subdomínio)

Imóveis mostrados:
- ✅ Apenas os 45 imóveis da XYZ
- ❌ Seus imóveis NÃO aparecem
- ❌ Imóveis de outras imobiliárias NÃO aparecem

Header:
- Logo: XYZ Imóveis (próprio)
- Telefone: (11) 91234-5678 (deles)
- Email: xyz@xyzimov eis.com.br (deles)
```

---

## 🎯 Decisão Necessária

Agora você precisa escolher qual estratégia de URL implementar:

**A) Path-based (Slug) - MVP Rápido**
- 👍 Implementa em 3-5 dias
- 👍 Custo R$ 3-5k
- 👍 Sem configurações de DNS
- URL: `seusite.com.br/imobiliaria-abc`

**B) Subdomínios - Produção Profissional**
- 👍 Implementa em 1-2 semanas
- 👍 Custo R$ 5-8k
- 👍 Muito mais profissional
- URL: `imobiliaria-abc.seusite.com.br`

**C) Híbrido (Recomendado)**
- 👍 Começa com Path-based (MVP)
- 👍 Depois migra para Subdomínios
- 👍 Valida antes de investir mais
- URLs: Ambas funcionando

---

## ❓ Próximos Passos

Qual caminho você prefere?

1. **"Vamos implementar Path-based (MVP) agora"**
   → Começo pela estrutura mais simples

2. **"Quero ir direto para Subdomínios"**
   → Implemento a solução profissional desde o início

3. **"Prefiro o Híbrido (começar simples, crescer depois)"**
   → Melhor custo-benefício

4. **"Quero entender melhor [algo específico]"**
   → Posso detalhar qualquer parte

Qual você escolhe? 🚀