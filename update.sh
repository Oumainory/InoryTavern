#!/bin/bash
echo "========================================"
echo "      InoryTavern 一键更新脚本"
echo "========================================"
echo ""
echo "[1/4] 正在从 GitHub 拉取最新代码..."
git pull
echo ""
echo "[2/4] 正在同步并安装依赖包 (npm install)..."
npm install
echo ""
echo "[3/4] 正在生成 Prisma 客户端..."
npx prisma generate
echo ""
echo "[4/4] 正在同步数据库结构 (prisma db push)..."
npx prisma db push
echo ""
echo "========================================"
echo "更新完成！你可以正常启动酒馆了。"
echo "========================================"
