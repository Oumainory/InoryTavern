@echo off
chcp 65001 >nul
echo ========================================
echo       InoryTavern 一键更新脚本
echo ========================================
echo.
echo [1/4] 正在从 GitHub 拉取最新代码...
git pull
echo.
echo [2/4] 正在同步并安装依赖包 (npm install)...
call npm install
echo.
echo [3/4] 正在生成 Prisma 客户端...
call npx prisma generate
echo.
echo [4/4] 正在同步数据库结构 (prisma db push)...
call npx prisma db push
echo.
echo ========================================
echo 更新完成！你可以关闭此窗口，并正常启动酒馆了。
echo ========================================
pause
