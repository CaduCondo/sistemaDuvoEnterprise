@echo off
echo ========================================
echo  SOFTGEN → GITHUB SYNC SCRIPT
echo ========================================
echo.
echo Este script sincroniza as alteracoes do Softgen com o GitHub
echo.

REM Verificar se estamos no diretorio correto
if not exist "package.json" (
    echo [ERRO] Execute este script na raiz do projeto!
    echo Navegue ate a pasta sistemaDuvoEnterprise antes de executar.
    pause
    exit /b 1
)

echo [1/6] Verificando status do Git...
git status

echo.
echo [2/6] Adicionando todas as alteracoes...
git add .

echo.
echo [3/6] Verificando se ha alteracoes para commit...
git diff-index --quiet HEAD
if %errorlevel% equ 0 (
    echo [INFO] Nenhuma alteracao para commitar.
    echo Tudo ja esta atualizado!
    pause
    exit /b 0
)

echo.
echo ========================================
echo  RESUMO DAS ALTERACOES:
echo ========================================
git status --short

echo.
set /p COMMIT_MSG="Digite a mensagem do commit (ou ENTER para mensagem padrao): "

if "%COMMIT_MSG%"=="" (
    REM Gerar mensagem automatica com data/hora
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
    for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
    set COMMIT_MSG=chore: sync from Softgen - %mydate% %mytime%
)

echo.
echo [4/6] Criando commit: "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"

echo.
echo [5/6] Enviando para GitHub (branch main)...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao fazer push para o GitHub!
    echo.
    echo Possiveis causas:
    echo - Voce nao tem permissao de escrita no repositorio
    echo - Sua autenticacao expirou
    echo - Conflitos com o repositorio remoto
    echo.
    echo Solucao: Execute 'git pull origin main' primeiro e resolva conflitos
    pause
    exit /b 1
)

echo.
echo [6/6] Verificando commits enviados...
git log --oneline -5

echo.
echo ========================================
echo  SUCESSO!
echo ========================================
echo Todas as alteracoes foram enviadas para o GitHub!
echo Repositorio: https://github.com/CaduCondo/sistemaDuvoEnterprise
echo.
pause