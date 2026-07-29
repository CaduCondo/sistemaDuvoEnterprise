@echo off
echo ========================================
echo  SOFTGEN → GITHUB SYNC SCRIPT
echo ========================================
echo.
echo Este script vai sincronizar suas alteracoes do Softgen para o GitHub!
echo Repositorio: https://github.com/CaduCondo/sistemaDuvoEnterprise
echo.
pause

echo [1/5] Verificando se estamos na pasta correta...
if not exist "package.json" (
    echo ERRO: Nao encontrado package.json na pasta atual!
    echo Por favor, execute este script na raiz do projeto.
    pause
    exit /b 1
)
echo OK - Pasta correta encontrada!
echo.

echo [2/5] Adicionando todas as alteracoes ao Git...
git add .
if errorlevel 1 (
    echo ERRO: Falha ao adicionar arquivos. Voce tem Git instalado?
    pause
    exit /b 1
)
echo OK - Arquivos adicionados!
echo.

echo [3/5] Resumo das mudancas:
git status --short
echo.

echo [4/5] Criando commit...
set /p CUSTOM_MSG="Digite a mensagem do commit (ou Enter para usar padrao): "
if "%CUSTOM_MSG%"=="" (
    set COMMIT_MSG=chore: sync from Softgen - %date% %time%
) else (
    set COMMIT_MSG=%CUSTOM_MSG%
)

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo AVISO: Nenhuma alteracao para commitar ou erro no commit.
    echo Continuando...
)
echo.

echo [5/5] Enviando para o GitHub...
git push origin main
if errorlevel 1 (
    echo ERRO: Falha ao fazer push. Verifique suas credenciais Git.
    echo.
    echo Dica: Talvez precise configurar um Personal Access Token
    echo GitHub → Settings → Developer Settings → Personal Access Tokens
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCESSO!
echo ========================================
echo.
echo Suas alteracoes foram sincronizadas com sucesso para o GitHub!
echo Repositorio: https://github.com/CaduCondo/sistemaDuvoEnterprise
echo.
pause