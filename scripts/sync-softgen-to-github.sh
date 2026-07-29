#!/bin/bash

echo "========================================"
echo "  SOFTGEN → GITHUB SYNC SCRIPT"
echo "========================================"
echo ""
echo "Este script sincroniza as alterações do Softgen com o GitHub"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}[ERRO]${NC} Execute este script na raiz do projeto!"
    echo "Navegue até a pasta sistemaDuvoEnterprise antes de executar."
    exit 1
fi

echo "[1/6] Verificando status do Git..."
git status

echo ""
echo "[2/6] Adicionando todas as alterações..."
git add .

echo ""
echo "[3/6] Verificando se há alterações para commit..."
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}[INFO]${NC} Nenhuma alteração para commitar."
    echo "Tudo já está atualizado!"
    exit 0
fi

echo ""
echo "========================================"
echo "  RESUMO DAS ALTERAÇÕES:"
echo "========================================"
git status --short

echo ""
read -p "Digite a mensagem do commit (ou ENTER para mensagem padrão): " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    # Gerar mensagem automática com data/hora
    COMMIT_MSG="chore: sync from Softgen - $(date '+%Y-%m-%d %H:%M')"
fi

echo ""
echo "[4/6] Criando commit: \"$COMMIT_MSG\""
git commit -m "$COMMIT_MSG"

echo ""
echo "[5/6] Enviando para GitHub (branch main)..."
git push origin main

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[ERRO]${NC} Falha ao fazer push para o GitHub!"
    echo ""
    echo "Possíveis causas:"
    echo "- Você não tem permissão de escrita no repositório"
    echo "- Sua autenticação expirou"
    echo "- Conflitos com o repositório remoto"
    echo ""
    echo "Solução: Execute 'git pull origin main' primeiro e resolva conflitos"
    exit 1
fi

echo ""
echo "[6/6] Verificando commits enviados..."
git log --oneline -5

echo ""
echo "========================================"
echo -e "${GREEN}  SUCESSO!${NC}"
echo "========================================"
echo "Todas as alterações foram enviadas para o GitHub!"
echo "Repositório: https://github.com/CaduCondo/sistemaDuvoEnterprise"
echo ""