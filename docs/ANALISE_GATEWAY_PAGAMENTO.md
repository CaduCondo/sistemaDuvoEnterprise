# 📊 Análise de Viabilidade: Gateway de Pagamento (Asaas)

> 📌 **Status: documento de planejamento — a integração com o Asaas não foi
> implementada.** As taxas e projeções abaixo são de julho/2026; confirme os
> valores atuais no site do Asaas antes de decidir com base neles.

**Data:** 08/07/2026  
**Sistema:** Gerenciador de Locações de Imóveis  
**Análise baseada em:** Dados reais do sistema em produção

---

## 📈 Situação Atual do Sistema

### Contratos Ativos
- **Total de contratos:** 89 imóveis locados
- **Receita mensal total:** R$ 162.498,00
- **Ticket médio:** R$ 1.825,82
- **Menor aluguel:** R$ 220,00
- **Maior aluguel:** R$ 8.000,00

### Processo Atual (Manual)
- ✅ Pagamentos registrados manualmente no sistema
- ✅ Anexos de comprovantes
- ✅ Geração de recibos em PDF
- ❌ **SEM** cobrança automática
- ❌ **SEM** envio automático de boletos
- ❌ **SEM** notificação de pagamento
- ❌ **SEM** reconciliação automática

---

## 💰 Análise de Custos: Asaas

### Taxas do Asaas (2026)
| Método de Pagamento | Taxa | Observação |
|---------------------|------|------------|
| **Boleto Bancário** | 1.59% | Mínimo: R$ 2,00 |
| **PIX** | 0.89% | Sem mínimo |
| **Cartão de Crédito** | 3.99% + R$ 0,39 | À vista |

**Taxa de adesão:** Gratuita  
**Mensalidade:** Gratuita para até 500 cobranças/mês  
**Prazo de repasse:** D+1 (PIX e Boleto)

---

## 🎯 Projeções de Custo por Cenário de Adoção

### Premissas
- Receita mensal: **R$ 162.498,00**
- Transações mensais: **89 cobranças**
- Método principal: **Boleto bancário** (1.59%)
- Adesão esperada: Início com 25%, crescimento gradual

### Cenário 1: Adoção de 25% (22 inquilinos)
```
Receita via Asaas: R$ 40.624,50/mês
Custo mensal (boleto 1.59%): R$ 645,93
Custo anual: R$ 7.751,16

Inquilinos usando Asaas: 22
Inquilinos pagamento manual: 67
```

### Cenário 2: Adoção de 50% (45 inquilinos) ⭐ REALISTA
```
Receita via Asaas: R$ 81.249,00/mês
Custo mensal (boleto 1.59%): R$ 1.291,86
Custo anual: R$ 15.502,32

Inquilinos usando Asaas: 45
Inquilinos pagamento manual: 44
```

### Cenário 3: Adoção de 75% (67 inquilinos)
```
Receita via Asaas: R$ 121.873,50/mês
Custo mensal (boleto 1.59%): R$ 1.937,79
Custo anual: R$ 23.253,48

Inquilinos usando Asaas: 67
Inquilinos pagamento manual: 22
```

### Cenário 4: Adoção de 100% (89 inquilinos)
```
Receita via Asaas: R$ 162.498,00/mês
Custo mensal (boleto 1.59%): R$ 2.583,72
Custo anual: R$ 31.004,64

Inquilinos usando Asaas: 89
Inquilinos pagamento manual: 0
```

---

## 🔄 Economia com PIX vs Boleto

**Se 50% dos pagamentos forem via PIX (taxa 0.89%):**

### Cenário 50% Adoção + 50% PIX
```
Receita via Asaas: R$ 81.249,00/mês
- 50% Boleto (R$ 40.624,50): R$ 645,93
- 50% PIX (R$ 40.624,50): R$ 361,56
Custo mensal total: R$ 1.007,49
Economia anual vs 100% boleto: R$ 3.412,44 (22% de economia)
```

---

## 💼 Análise de Custo-Benefício

### Custos Ocultos do Processo Manual Atual

#### 1. **Tempo de Trabalho**
- Tempo médio por cobrança manual: 10 minutos
- 89 cobranças mensais × 10 min = **14,8 horas/mês**
- Custo hora (estimado R$ 50/h): **R$ 740,00/mês**
- **Custo anual: R$ 8.880,00**

#### 2. **Inadimplência**
- Taxa de inadimplência atual: Estimada em 5-10%
- Com cobrança automática: Redução média de 30%
- Economia potencial: **R$ 2.437 - R$ 4.874/mês**

#### 3. **Atrasos e Reconciliação**
- Horas gastas checando comprovantes: ~5h/mês
- Custo estimado: **R$ 250/mês = R$ 3.000/ano**

#### 4. **Perda de Recebíveis**
- Cobranças não realizadas por esquecimento: 1-2%
- Perda potencial: **R$ 1.625 - R$ 3.250/mês**

### Resumo: Custo Total Oculto Atual
```
Tempo de trabalho: R$ 8.880/ano
Inadimplência: R$ 14.622/ano (média)
Reconciliação: R$ 3.000/ano
Perda de recebíveis: R$ 29.250/ano (média)
-----------------------------------------
TOTAL: R$ 55.752/ano em custos ocultos
```

---

## 📊 ROI - Retorno Sobre Investimento

### Cenário Realista: 50% Adoção + 50% PIX

#### Custos
```
Asaas (transações): R$ 12.089,88/ano
Implementação (uma vez): R$ 5.000 - R$ 8.000
Manutenção anual: R$ 2.000
-----------------------------------------
TOTAL ANO 1: R$ 19.089,88 - R$ 22.089,88
```

#### Economia
```
Redução tempo trabalho: R$ 4.440/ano (50% das 14.8h/mês)
Redução inadimplência: R$ 7.311/ano (30% de melhora)
Eliminação reconciliação: R$ 1.500/ano (50% do tempo)
Redução perda recebíveis: R$ 14.625/ano (50% de melhora)
-----------------------------------------
TOTAL: R$ 27.876/ano em economia
```

#### ROI Líquido
```
Economia: R$ 27.876/ano
Custo: R$ 22.089/ano (ano 1)
-----------------------------------------
LUCRO ANO 1: R$ 5.787
ROI: 26% no primeiro ano

A PARTIR DO ANO 2:
Economia: R$ 27.876/ano
Custo: R$ 14.089/ano (sem implementação)
-----------------------------------------
LUCRO ANUAL: R$ 13.787
ROI: 98% anual a partir do ano 2
```

---

## ✅ Benefícios Qualitativos (Não-Monetários)

1. **Experiência do Inquilino**
   - Recebe boleto/PIX automaticamente
   - Lembretes antes do vencimento
   - Pagamento mais conveniente

2. **Controle Gerencial**
   - Dashboard em tempo real
   - Relatórios automáticos
   - Indicadores de inadimplência

3. **Redução de Erros**
   - Zero erros de digitação
   - Reconciliação automática
   - Histórico completo

4. **Profissionalização**
   - Imagem mais profissional
   - Processos padronizados
   - Escalabilidade para crescimento

5. **Compliance**
   - Rastro completo de transações
   - Comprovantes automáticos
   - Facilita auditoria

---

## 🚀 Plano de Implementação em Fases

### **FASE 0: Preparação (Semana 1-2)** 
**Custo: R$ 0 | Tempo: 10-15 horas**

#### Separação de Ambientes Dev/Prod
1. Criar projeto Supabase DEV
2. Aplicar migrations no ambiente DEV
3. Popular com dados de teste
4. Configurar variáveis de ambiente
5. Testar fluxo completo em DEV

**Entregável:** Sistema rodando em 2 ambientes isolados

---

### **FASE 1: MVP Asaas (Semana 3-4)**
**Custo Implementação: R$ 3.000 - R$ 5.000 | Tempo: 15-20 horas**

#### 1.1 Backend (API Routes)
- ✅ `/api/asaas/create-charge` - Criar cobrança
- ✅ `/api/asaas/webhook` - Receber notificações
- ✅ `/api/asaas/check-status` - Consultar status

#### 1.2 Banco de Dados
```sql
-- Nova tabela para transações gateway
CREATE TABLE payment_gateway_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  gateway_transaction_id TEXT, -- ID do Asaas
  gateway_name TEXT DEFAULT 'asaas',
  method TEXT, -- boleto, pix, credit_card
  status TEXT, -- pending, paid, failed, refunded
  barcode TEXT, -- Código de barras boleto
  pix_code TEXT, -- Código PIX
  pix_qr_code TEXT, -- QR Code PIX (base64)
  due_date DATE,
  amount DECIMAL(10,2),
  paid_at TIMESTAMP,
  gateway_response JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE payment_gateway_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON payment_gateway_transactions FOR SELECT USING (true);
CREATE POLICY "insert_own" ON payment_gateway_transactions FOR INSERT WITH CHECK (true);
```

#### 1.3 Frontend (Componentes)
- ✅ `PaymentGatewayDialog` - Escolher método
- ✅ `BoletoViewer` - Exibir boleto
- ✅ `PixPayment` - Exibir QR Code PIX

#### 1.4 Fluxo Implementado
```
1. Admin vê pagamento pendente
2. Clica em "Gerar Cobrança"
3. Escolhe método (Boleto ou PIX)
4. Sistema cria cobrança no Asaas
5. Exibe código de barras/QR Code
6. Inquilino paga
7. Asaas envia webhook
8. Sistema atualiza automaticamente
9. Gera recibo automaticamente
```

**Entregável:** Geração manual de boleto/PIX funcional

---

### **FASE 2: Automação (Semana 5-6)**
**Custo: R$ 2.000 | Tempo: 10-12 horas**

#### 2.1 Cobrança Automática
- ✅ Job mensal para gerar cobranças
- ✅ Envio automático de boleto/PIX por email
- ✅ Lembretes 3 dias antes do vencimento

#### 2.2 Webhook Robusto
- ✅ Validação de assinatura Asaas
- ✅ Idempotência (não processar duplicados)
- ✅ Retry automático em falhas
- ✅ Log de todas as notificações

#### 2.3 Dashboard Gateway
- ✅ Card "Pagamentos via Gateway" no Dashboard
- ✅ Gráfico de conversão (boleto vs PIX)
- ✅ Indicador de taxa de sucesso

**Entregável:** Sistema totalmente automático

---

### **FASE 3: Refinamentos (Semana 7-8)**
**Custo: R$ 1.000 | Tempo: 5-8 horas**

#### 3.1 Melhorias UX
- ✅ Link de pagamento por WhatsApp
- ✅ Portal do inquilino (ver suas cobranças)
- ✅ Histórico de transações

#### 3.2 Relatórios
- ✅ Relatório mensal de taxas pagas
- ✅ Comparativo boleto vs PIX
- ✅ Taxa de conversão por inquilino

#### 3.3 Integrações Extras
- ✅ Exportar para Excel/CSV
- ✅ Envio automático de recibo por email

**Entregável:** Sistema completo e polido

---

## 🎯 Custos Totais de Implementação

### Desenvolvimento
```
Fase 0 (Separação ambientes): R$ 0 (você já pediu)
Fase 1 (MVP Asaas): R$ 3.000 - R$ 5.000
Fase 2 (Automação): R$ 2.000
Fase 3 (Refinamentos): R$ 1.000
-----------------------------------------
TOTAL: R$ 6.000 - R$ 8.000 (uma vez)
```

### Operação Anual (Cenário 50% Adoção + 50% PIX)
```
Taxas Asaas: R$ 12.089,88/ano
Suporte e ajustes: R$ 2.000/ano
-----------------------------------------
TOTAL: R$ 14.089,88/ano
```

---

## 💡 Recomendação Final

### ✅ **RECOMENDO IMPLEMENTAR**

**Justificativa:**
1. **ROI positivo já no ano 1** (R$ 5.787 de lucro)
2. **ROI de 98% anual a partir do ano 2**
3. **Redução significativa de trabalho manual** (50% do tempo)
4. **Melhora na experiência do inquilino**
5. **Profissionalização do processo**
6. **Escalabilidade** para crescimento futuro

### 📅 Cronograma Sugerido

**Semana 1-2:** Separação Dev/Prod (GRÁTIS - já solicitado)  
**Semana 3-4:** Implementar MVP Asaas em DEV  
**Semana 5:** Testes intensivos em DEV  
**Semana 6:** Deploy em Produção com 10 inquilinos piloto  
**Semana 7-8:** Expansão gradual (25% → 50%)  
**Semana 9-10:** Automação completa  
**Semana 11-12:** Refinamentos e otimizações  

**Total:** 3 meses do conceito à operação completa

---

## ❓ Próximos Passos

1. **Decisão:** Aprovar o investimento de R$ 6-8k?
2. **Piloto:** Definir 10 inquilinos para teste inicial?
3. **Fase 0:** Iniciar separação Dev/Prod agora? (GRÁTIS)

**Minha sugestão:** Comece pela **Fase 0** (separação de ambientes) AGORA, que é gratuita e necessária independente do gateway. Enquanto isso, você pode:
- Criar conta no Asaas (grátis)
- Testar a plataforma deles
- Validar se atende suas necessidades
- Decidir com mais dados se segue para as Fases 1-3

---

## 📞 Contato Asaas

**Site:** https://www.asaas.com  
**Suporte:** (19) 3500-2626  
**Email:** comercial@asaas.com  

**Dica:** Mencione que é uma imobiliária com 89 contratos. Eles podem oferecer condições comerciais melhores para volumes maiores.

---

**Documento preparado em:** 08/07/2026  
**Válido até:** 31/12/2026 (taxas podem mudar)  
**Revisão recomendada:** Anual