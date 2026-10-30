#!/usr/bin/env bash
# Reset do banco de DEV a partir de PRODUCAO, com dados pessoais mascarados
# (issue #36). Roda pelo workflow .github/workflows/reset-dev.yml.
#
# Precisa de:
#   PROD_DB_URL  connection string do banco de PRODUCAO (so leitura aqui)
#   DEV_DB_URL   connection string do banco de DEV (vai ser substituido)
#   pg_dump/psql versao >= a do servidor Supabase
#
# Seguranca:
#   - guard.js confere que origem=PROD e destino=DEV ANTES de qualquer coisa;
#   - PRODUCAO so e lida (pg_dump), nunca escrita;
#   - tudo no DEV roda numa transacao unica: se qualquer passo falhar, o DEV
#     volta exatamente ao que era antes.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
node "$AQUI/guard.js"

echo "pg_dump: $(pg_dump --version)"
echo "Versao do Postgres em PROD: $(psql "$PROD_DB_URL" -tAc 'show server_version')"
echo "Versao do Postgres em DEV:  $(psql "$DEV_DB_URL" -tAc 'show server_version')"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) Copia de PRODUCAO (so o schema "public" = as tabelas do sistema), em 3
#    partes: estrutura, dados e "o resto" (indices, chaves, gatilhos,
#    politicas de seguranca). O mascaramento roda entre os dados e o resto.
for parte in pre-data data post-data; do
  pg_dump "$PROD_DB_URL" --schema=public --no-owner --section="$parte" -f "$TMP/$parte.sql"
done

# Linhas que nao se aplicam ao DEV:
#   CREATE/COMMENT SCHEMA public -> o schema ja existe no DEV (so o conteudo e trocado)
#   SET transaction_timeout      -> so existe a partir do Postgres 17
sed -i -E \
  -e '/^CREATE SCHEMA ("?public"?);/d' \
  -e '/^COMMENT ON SCHEMA ("?public"?) /d' \
  -e '/^SET transaction_timeout/d' \
  "$TMP"/*.sql

# As permissoes de PROD (linhas GRANT/REVOKE/ALTER DEFAULT PRIVILEGES da
# copia), para reaplicar no fim por cima de permissoes zeradas -- ver
# 4-zerar-permissoes.sql.
grep -hE '^(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES) ' "$TMP/pre-data.sql" "$TMP/post-data.sql" > "$TMP/permissoes.sql" || true

ls -lh "$TMP"

# 2) Aplica no DEV, tudo numa transacao so.
psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q \
  -f "$AQUI/1-limpar-dev.sql" \
  -f "$TMP/pre-data.sql" \
  -f "$TMP/data.sql" \
  -f "$AQUI/3-anonimizar.sql" \
  -f "$TMP/post-data.sql" \
  -f "$AQUI/4-zerar-permissoes.sql" \
  -f "$TMP/permissoes.sql" \
  -c "NOTIFY pgrst, 'reload schema';"

# 3) Resumo para o log do GitHub Actions.
echo "Reset concluido. Quantidades no DEV agora:"
psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT 'imoveis' AS tabela, count(*) FROM public.properties
  UNION ALL SELECT 'inquilinos', count(*) FROM public.tenants
  UNION ALL SELECT 'locacoes', count(*) FROM public.rentals
  UNION ALL SELECT 'recebimentos', count(*) FROM public.payments
  UNION ALL SELECT 'usuarios', count(*) FROM public.system_users;"
