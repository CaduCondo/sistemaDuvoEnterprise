# language: pt
@locais
Funcionalidade: Contas a Pagar por Local (Configurações)
  Como um usuário Admin
  Quero cadastrar uma conta a pagar vinculada a um Local com o mês/ano que eu escolher
  Para que ela apareça certinha no detalhamento daquele mês, sem ir parar no mês errado

  Contexto:
    Dado que fiz login como "admin"

  # ⚠️ Bug encontrado pelo Cadu em 08/out/2026 (prints anexados): com o
  # detalhamento das Contas a Pagar de um Local já filtrado no mês atual
  # (ex.: Out/2026), ele abriu "Nova Conta", preencheu Tipo=Água e Valor,
  # deixou Mês/Ano no padrão (que também já nasce no mês atual) e clicou
  # "Adicionar". O sistema confirmou "Conta cadastrada com sucesso", mas a
  # conta NÃO apareceu na lista de Out/2026 -- só apareceu ao trocar o
  # filtro para Set/2026 (mês ANTERIOR).
  #
  # Causa raiz (LocationExpensesDialog.tsx, handleSave): o código montava
  # uma string "AAAA-M-DD" (ex.: "2026-10-01") e recriava um `new Date(...)`
  # só para ler de volta `.getMonth()+1`/`.getFullYear()` -- redundante, já
  # que os campos do formulário (Mês/Ano) já são números prontos. O
  # problema: essa string ISO é interpretada pelo motor JS como meia-noite
  # em UTC, e `.getMonth()`/`.getFullYear()` leem de volta no fuso LOCAL do
  # navegador. Para quem está num fuso atrás de UTC (Brasil, UTC-3),
  # meia-noite de 1º/10 em UTC ainda é 30/09 à noite no horário local -- a
  # conta era gravada e exibida um mês atrás do que foi selecionado.
  #
  # Corrigido usando os números já selecionados nos campos Mês/Ano direto,
  # sem passar por nenhum `Date`. Este cenário reproduz exatamente o fluxo
  # do Cadu: não mexe em Mês/Ano (ambos já nascem no mês/ano atual, tanto no
  # filtro quanto no formulário) e confere que a conta aparece na lista
  # SEM precisar trocar o filtro.
  @sistemaCompleto
  Cenário: Conta cadastrada com o mês atual aparece na lista desse mesmo mês, sem trocar o filtro
    Dado que existe um local "Local Contas E2E"
    Quando abro a aba "Locais" das Configurações
    E abro as Contas a Pagar do local
    E clico em "Nova Conta"
    E preencho a conta a pagar com tipo "Água", valor "555.00" e descrição "Conta de teste E2E"
    E clico em "Adicionar"
    Então devo ver a conta "Conta de teste E2E" na lista de Contas a Pagar, no mês atual

  # ⚠️ Bug encontrado pelo Cadu em 08/out/2026 (print anexado): o diálogo
  # "Detalhamento das Contas do Mês" mostrava 2 blocos quase iguais de
  # título+subtítulo na mesma tela. Causa: o bloco de cabeçalho de
  # IMPRESSÃO (`.print-header`) não tinha a classe "hidden" -- o CSS que
  # some com ele só existe dentro de `@media print`, então ele ficava
  # visível na TELA também, duplicando o cabeçalho de verdade
  # (DialogHeader, logo abaixo). Corrigido com "hidden print:block".
  @sistemaCompleto
  Cenário: Detalhamento das Contas do Mês mostra só 1 cabeçalho com título e subtítulo
    Dado que existe um local "Local Cabecalho E2E"
    Quando abro a aba "Locais" das Configurações
    E abro as Contas a Pagar do local
    Então devo ver só 1 cabeçalho "Detalhamento das Contas do Mês" na tela
