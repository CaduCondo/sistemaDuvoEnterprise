# 🤝 Guia de Contribuição

Obrigado por considerar contribuir com o Sistema de Gerenciamento de Locações!

---

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Padrões de Código](#padrões-de-código)
- [Fluxo de Git](#fluxo-de-git)
- [Testes](#testes)
- [Documentação](#documentação)

---

## 📜 Código de Conduta

Este projeto adota um Código de Conduta que todos os contribuidores devem seguir:

- **Seja respeitoso**: Trate todos com respeito e consideração
- **Seja colaborativo**: Trabalhe junto para encontrar as melhores soluções
- **Seja construtivo**: Forneça feedback construtivo e aceite críticas
- **Seja inclusivo**: Todos são bem-vindos, independentemente de experiência

---

## 🚀 Como Contribuir

### Tipos de Contribuição

1. **Reportar Bugs**
   - Abra uma issue com label `bug`
   - Descreva o problema detalhadamente
   - Inclua steps to reproduce
   - Adicione screenshots se aplicável

2. **Sugerir Features**
   - Abra uma issue com label `enhancement`
   - Descreva o caso de uso
   - Explique o benefício esperado

3. **Melhorar Documentação**
   - Corrija typos
   - Adicione exemplos
   - Melhore explicações
   - Traduza documentos

4. **Contribuir com Código**
   - Corrija bugs
   - Implemente features
   - Otimize performance
   - Refatore código

---

## 💻 Configuração do Ambiente

### 1. Fork e Clone

```bash
# Fork no GitHub
# Depois clone seu fork
git clone https://github.com/CaduCondo/sistemaDuvoEnterprise.git
cd sistemaDuvoEnterprise

# Adicione o upstream
git remote add upstream https://github.com/CaduCondo/sistemaDuvoEnterprise.git
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Supabase Local

```bash
# Copie o .env.example
cp .env.example .env.local

# Adicione suas credenciais de desenvolvimento
NEXT_PUBLIC_SUPABASE_URL=seu-url-dev
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-key-dev
```

### 4. Rodar Localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## 📏 Padrões de Código

### TypeScript

```typescript
// ✅ BOM: Tipos explícitos
interface UserData {
  id: string;
  name: string;
  email: string;
}

function createUser(data: UserData): Promise<User> {
  return api.createUser(data);
}

// ❌ RUIM: Sem tipos
function createUser(data: any) {
  return api.createUser(data);
}
```

### Nomenclatura

```typescript
// Componentes: PascalCase
export function PropertyCard() {}

// Hooks: camelCase com prefixo 'use'
export function useProperties() {}

// Services: camelCase com sufixo 'Service'
export const propertyService = {}

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10485760;

// Variáveis: camelCase
const userName = "João";
```

### Importações

```typescript
// Ordem de imports:
// 1. React e bibliotecas externas
import { useState } from "react";
import { useRouter } from "next/router";

// 2. Componentes
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/properties/PropertyCard";

// 3. Hooks
import { useProperties } from "@/hooks/useProperties";

// 4. Services
import { fetchProperties } from "@/services/propertyService";

// 5. Types
import type { Property } from "@/types";

// 6. Utils
import { formatCurrency } from "@/lib/utils";
```

### Componentes React

```typescript
// Template de componente
interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, onEdit, onDelete }: PropertyCardProps) {
  // 1. Hooks
  const [isLoading, setIsLoading] = useState(false);
  
  // 2. Handlers
  const handleEdit = () => {
    onEdit?.(property);
  };
  
  // 3. Effects
  useEffect(() => {
    // ...
  }, []);
  
  // 4. Render
  return (
    <Card>
      {/* JSX */}
    </Card>
  );
}
```

### ESLint

Projeto usa ESLint configurado. Rode antes de commit:

```bash
npm run lint
```

### Formatação

```bash
# Auto-format com ESLint
npm run lint -- --fix
```

---

## 🌳 Fluxo de Git

### Branches

```
main            - Produção estável
develop         - Desenvolvimento ativo
feature/nome    - Nova feature
fix/nome        - Bug fix
docs/nome       - Documentação
refactor/nome   - Refatoração
```

### Criando uma Feature

```bash
# 1. Atualize develop
git checkout develop
git pull upstream develop

# 2. Crie branch da feature
git checkout -b feature/nome-da-feature

# 3. Faça commits
git add .
git commit -m "feat: descrição da feature"

# 4. Push para seu fork
git push origin feature/nome-da-feature

# 5. Abra Pull Request no GitHub
```

### Mensagens de Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Tipos
feat:     Nova feature
fix:      Bug fix
docs:     Documentação
style:    Formatação (não afeta código)
refactor: Refatoração
test:     Testes
chore:    Manutenção

# Exemplos
git commit -m "feat: adicionar filtro por localização"
git commit -m "fix: corrigir cálculo de multa"
git commit -m "docs: atualizar README com instruções de deploy"
git commit -m "refactor: simplificar lógica de rescisão"
```

### Pull Requests

**Template de PR:**

```markdown
## Descrição
Descreva o que foi feito e por quê.

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Checklist
- [ ] Código segue padrões do projeto
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] ESLint passa sem erros
- [ ] Build de produção funciona

## Screenshots (se aplicável)
```

---

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
npm test

# Modo watch
npm test -- --watch

# Com coverage
npm test -- --coverage
```

### Escrevendo Testes

```typescript
// exemplo.test.ts
import { calculateLateFees } from "@/lib/rentalCalculations";

describe("calculateLateFees", () => {
  it("deve calcular multa de 2%", () => {
    const result = calculateLateFees(1000, 10);
    expect(result.lateFee).toBe(20);
  });
  
  it("deve calcular juros proporcionais", () => {
    const result = calculateLateFees(1000, 10);
    expect(result.interest).toBeCloseTo(3.33, 2);
  });
});
```

---

## 📚 Documentação

### Atualizando Docs

Ao adicionar/modificar features:

1. **Atualize README.md** se necessário
2. **Atualize docs relevantes**:
   - ARCHITECTURE.md - Mudanças arquiteturais
   - REGRAS_DE_NEGOCIO.md - Novas regras de negócio
   - API_DOCUMENTATION.md - Novos endpoints/serviços
   - DATABASE_SCHEMA.md - Mudanças no schema

### JSDoc

```typescript
/**
 * Calcula multa e juros para pagamento atrasado
 * 
 * @param rentAmount - Valor do aluguel
 * @param daysLate - Dias de atraso
 * @returns Objeto com lateFee e interest
 * 
 * @example
 * const fees = calculateLateFees(1000, 10);
 * // { lateFee: 20, interest: 3.33 }
 */
export function calculateLateFees(rentAmount: number, daysLate: number) {
  // ...
}
```

---

## 🐛 Reportando Bugs

### Template de Issue

```markdown
**Descrição**
Descrição clara e concisa do bug.

**Steps to Reproduce**
1. Vá para '...'
2. Clique em '...'
3. Veja o erro

**Comportamento Esperado**
O que deveria acontecer.

**Comportamento Atual**
O que realmente acontece.

**Screenshots**
Adicione screenshots se aplicável.

**Ambiente**
- OS: [Windows/Mac/Linux]
- Browser: [Chrome, Firefox, Safari]
- Versão: [v1.0.0]

**Informações Adicionais**
Qualquer outra informação relevante.
```

---

## ✅ Checklist de PR

Antes de abrir um Pull Request:

- [ ] Código está no padrão do projeto
- [ ] ESLint passa sem erros (`npm run lint`)
- [ ] Build de produção funciona (`npm run build`)
- [ ] Testes passam (`npm test`)
- [ ] Documentação atualizada
- [ ] Commits seguem Conventional Commits
- [ ] Branch está atualizada com develop
- [ ] PR tem título descritivo
- [ ] PR tem descrição completa

---

## 🎯 Áreas que Precisam de Ajuda

Estamos sempre procurando ajuda com:

1. **Testes**: Aumentar cobertura de testes
2. **Documentação**: Melhorar exemplos e guias
3. **Performance**: Otimizações
4. **Acessibilidade**: Melhorias WCAG
5. **Internacionalização**: Traduzir para outros idiomas
6. **Features**: Veja issues com label `good first issue`

---

## 💬 Comunicação

- **GitHub Issues**: Para bugs e features
- **GitHub Discussions**: Para perguntas e ideias
- **Email**: contribuir@exemplo.com

---

## 📝 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto.

---

**Obrigado por contribuir! 🎉**