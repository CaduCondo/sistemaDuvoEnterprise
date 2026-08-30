# language: pt
Funcionalidade: Gestão de Cauções
  Como administrador do sistema
  Quero gerenciar cauções de locações
  Para controlar os depósitos de segurança

  Contexto:
    Dado que estou logado como "admin"
    E existe uma localização "ACÁCIAS"
    E existe um imóvel "Casa 1" disponível
    E existe um inquilino "João Silva"

  @smoke
  Cenário: Criar locação com caução à vista
    Quando crio uma locação com:
      | imóvel           | Casa 1      |
      | inquilino        | João Silva  |
      | data_início      | 01/01/2026  |
      | data_fim         | 31/12/2026  |
      | aluguel          | 1000        |
      | caução           | 1200        |
      | parcelas_caução  | 1           |
    Então o sistema cria 1 parcela de caução
    E a parcela 1 tem valor 1200.00
    E a parcela 1 tem vencimento "01/01/2026"
    E a parcela 1 tem status "pending"

  Cenário: Criar locação com caução parcelado em 2x
    Quando crio uma locação com:
      | imóvel           | Casa 1      |
      | inquilino        | João Silva  |
      | data_início      | 01/01/2026  |
      | data_fim         | 31/12/2026  |
      | aluguel          | 1000        |
      | caução           | 1200        |
      | parcelas_caução  | 2           |
      | data_venc_2      | 01/02/2026  |
    Então o sistema cria 2 parcelas de caução
    E a parcela 1 tem valor 600.00
    E a parcela 1 tem vencimento "01/01/2026"
    E a parcela 2 tem valor 600.00
    E a parcela 2 tem vencimento "01/02/2026"

  @smoke
  Cenário: Criar locação com caução parcelado em 3x
    Quando crio uma locação com:
      | imóvel           | Casa 1      |
      | inquilino        | João Silva  |
      | data_início      | 01/01/2026  |
      | data_fim         | 31/12/2026  |
      | aluguel          | 1000        |
      | caução           | 1200        |
      | parcelas_caução  | 3           |
      | data_venc_2      | 01/02/2026  |
      | data_venc_3      | 01/03/2026  |
    Então o sistema cria 3 parcelas de caução
    E a parcela 1 tem valor 400.00
    E a parcela 1 tem vencimento "01/01/2026"
    E a parcela 2 tem valor 400.00
    E a parcela 2 tem vencimento "01/02/2026"
    E a parcela 3 tem valor 400.00
    E a parcela 3 tem vencimento "01/03/2026"

  Cenário: Ajuste de centavos na última parcela
    Quando crio uma locação com:
      | imóvel           | Casa 1      |
      | inquilino        | João Silva  |
      | data_início      | 01/01/2026  |
      | data_fim         | 31/12/2026  |
      | aluguel          | 1000        |
      | caução           | 1000        |
      | parcelas_caução  | 3           |
      | data_venc_2      | 01/02/2026  |
      | data_venc_3      | 01/03/2026  |
    Então o sistema cria 3 parcelas de caução
    E a parcela 1 tem valor 333.33
    E a parcela 2 tem valor 333.33
    E a parcela 3 tem valor 333.34

  @smoke
  Cenário: Marcar parcela de caução como recebida via PIX
    Dado que existe uma locação com caução em 3x
    Quando marco a parcela 1 como recebida:
      | pix_code        | 00020126580014br.gov.bcb.pix |
      | data_pagamento  | 01/01/2026                    |
    Então a parcela 1 tem status "paid"
    E a parcela 1 tem pix_code preenchido
    E a linha da parcela 1 fica verde na tabela

  Cenário: Editar comissão de corretor parceiro inline
    Dado que existe uma locação com caução em 3x
    E a locação tem corretor parceiro
    Quando acesso o relatório financeiro de cauções
    E clico para editar comissão parceiro
    E altero o valor para 360.00
    E salvo a alteração
    Então todas as parcelas mostram comissão parceiro 360.00
    E os KPIs são recalculados

  Cenário: Editar comissão de corretor interno inline
    Dado que existe uma locação com caução em 3x
    Quando acesso o relatório financeiro de cauções
    E clico para editar comissão interno
    E altero o valor para 240.00
    E salvo a alteração
    Então todas as parcelas mostram comissão interno 240.00
    E os KPIs são recalculados

  Cenário: Editar valor da parcela inline
    Dado que existe uma locação com caução em 3x
    Quando acesso o relatório financeiro de cauções
    E clico para editar valor da parcela 1
    E altero o valor para 450.00
    E salvo a alteração
    Então a parcela 1 tem valor 450.00
    E o total de cauções é recalculado

  Cenário: Registrar valor devolvido em contrato cancelado
    Dado que existe uma locação cancelada
    E a locação tinha caução de 1200.00
    Quando acesso o relatório financeiro de cauções
    E seleciono filtro "Canceladas"
    E clico para editar valor devolvido
    E altero o valor para 900.00
    E salvo a alteração
    Então o valor devolvido é 900.00
    E o valor aparece em vermelho

  Cenário: Filtrar cauções por status de locação
    Dado que existem locações ativas e canceladas com caução
    Quando acesso o relatório financeiro de cauções
    E seleciono filtro "Ativas"
    Então vejo apenas parcelas de locações ativas
    E não vejo a coluna "Valor Devolvido"

  Cenário: Visualizar valor devolvido apenas em locações inativas
    Dado que existem locações ativas e canceladas com caução
    Quando acesso o relatório financeiro de cauções
    E seleciono filtro "Canceladas"
    Então vejo apenas parcelas de locações canceladas
    E vejo a coluna "Valor Devolvido"

  Cenário: KPIs do relatório de cauções
    Dado que existem 3 locações com caução
    E 2 parcelas foram recebidas (total R$ 800)
    E 1 parcela está pendente (R$ 400)
    E comissão total é R$ 200
    Quando acesso o relatório financeiro de cauções
    Então vejo KPI "Cauções Esperados" = 1200.00
    E vejo KPI "Cauções Recebidos" = 800.00
    E vejo KPI "Comissões Pagas" = 200.00
    E vejo KPI "Receita Líquida" = 600.00

  Cenário: Comissões aparecem uma única vez por locação
    Dado que existe uma locação com caução em 3x
    E a locação tem comissão parceiro 360.00
    E a locação tem comissão interno 240.00
    Quando acesso o relatório financeiro de cauções
    Então vejo as comissões mescladas (rowspan) nas 3 parcelas
    E o valor total de comissões é 600.00

  Cenário: Coloração de linhas por status de recebimento
    Dado que existe uma locação com caução em 3x
    E a parcela 1 foi recebida (tem pix_code)
    E as parcelas 2 e 3 estão pendentes
    Quando acesso o relatório financeiro de cauções
    Então a linha da parcela 1 tem fundo verde
    E as linhas das parcelas 2 e 3 têm fundo vermelho

  Cenário: Ordenação por coluna
    Dado que existem 5 locações com caução
    Quando acesso o relatório financeiro de cauções
    E clico para ordenar por "Local"
    Então as locações são ordenadas alfabeticamente
    Quando clico novamente
    Então a ordem é invertida

  Cenário: Exportar relatório para Excel
    Dado que existem locações com caução
    Quando acesso o relatório financeiro de cauções
    E clico em "Exportar Excel"
    Então um arquivo XLSX é baixado
    E o arquivo contém todas as parcelas visíveis
    E o arquivo contém a linha de totais