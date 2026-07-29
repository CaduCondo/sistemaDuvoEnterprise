#!/bin/bash

echo "========================================"
echo "  SOFTGEN → GITHUB SYNC SCRIPT"
echo "========================================"
echo ""
echo "Este script vai sincronizar suas alterações do Softgen para o GitHub!"
echo "Repositório: https://github.com/CaduCondo/sistemaDuvoEnterprise"
echo ""
read -p "Pressione Enter para continuar..."

echo "[1/5] Verificando se estamos na pasta correta..."
if [ ! -f "package.json" ]; then
    echo "❌ ERRO: Não encontrado package.json na pasta atual!"
    echo "Por favor, execute este script na raiz do projeto."
    exit 1
fi
echo "✅ OK - Pasta correta encontrada!"
echo ""

echo "[2/5] Adicionando todas as alterações ao Git..."
git add .
if [ $? -ne 0 ]; then
    echo "❌ ERRO: Falha ao adicionar arquivos. Você tem Git instalado?"
    exit 1
fi
echo "✅ OK - Arquivos adicionados!"
echo ""

echo "[3/5] Resumo das mudanças:"
git status --short
echo ""

echo "[4/5] Criando commit..."
read -p "Digite a mensagem do commit (ou Enter para usar padrão): " CUSTOM_MSG
if [ -z "$CUSTOM_MSG" ]; then
    COMMIT_MSG="chore: sync from Softgen - $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$CUSTOM_MSG"
fi

git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    echo "⚠️ AVISO: Nenhuma alteração para commitar ou erro no commit."
    echo "Continuando..."
fi
echo ""

echo "[5/5] Enviando para o GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "❌ ERRO: Falha ao fazer push. Verifique suas credenciais Git."
    echo ""
    echo "💡 Dica: Talvez precise configurar um Personal Access Token"
    echo "GitHub → Settings → Developer Settings → Personal Access Tokens"
    exit 1
fi

echo ""
echo "========================================"
echo "  ✅ SUCESSO!"
echo "========================================"
echo ""
echo "Suas alterações foram sincronizadas com sucesso para o GitHub!"
echo "Repositório: https://github.com/CaduCondo/sistemaDuvoEnterprise"
echo ""