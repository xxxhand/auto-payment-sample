#!/bin/bash

# 綠界 ECPay 自動支付系統 - 生產部署腳本
# ECPay Auto Payment System - Production Deployment Script

set -e  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：打印帶顏色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 函數：檢查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_message $BLUE "🚀 ECPay 自動支付系統 - 生產部署開始"
print_message $BLUE "=================================================="

# 1. 檢查必要工具
print_message $YELLOW "📋 檢查部署環境..."

if ! command_exists docker; then
    print_message $RED "❌ Docker 未安裝，請先安裝 Docker"
    exit 1
fi

if ! command_exists docker-compose; then
    print_message $RED "❌ Docker Compose 未安裝，請先安裝 Docker Compose"
    exit 1
fi

print_message $GREEN "✅ Docker 環境檢查通過"

# 2. 檢查配置文件
print_message $YELLOW "🔧 檢查配置文件..."

if [ ! -f ".env.production" ]; then
    if [ -f ".env.production.example" ]; then
        print_message $YELLOW "⚠️  .env.production 不存在，從範例複製..."
        cp .env.production.example .env.production
        print_message $RED "❌ 請編輯 .env.production 文件並設定正確的生產環境參數"
        print_message $YELLOW "需要設定的重要參數："
        print_message $YELLOW "- ECPAY_MERCHANT_ID (綠界商店代號)"
        print_message $YELLOW "- ECPAY_HASH_KEY (綠界 HashKey)"
        print_message $YELLOW "- ECPAY_HASH_IV (綠界 HashIV)"
        print_message $YELLOW "- ECPAY_RETURN_URL (回調 URL)"
        print_message $YELLOW "- DB_HOST, DB_USER, DB_PASSWORD (資料庫設定)"
        exit 1
    else
        print_message $RED "❌ 找不到 .env.production.example 文件"
        exit 1
    fi
fi

print_message $GREEN "✅ 配置文件檢查通過"

# 3. 檢查 ECPay 配置
print_message $YELLOW "🏦 驗證 ECPay 配置..."

source .env.production

if [ -z "$ECPAY_MERCHANT_ID" ] || [ -z "$ECPAY_HASH_KEY" ] || [ -z "$ECPAY_HASH_IV" ]; then
    print_message $RED "❌ ECPay 配置不完整，請檢查以下環境變數："
    print_message $RED "   - ECPAY_MERCHANT_ID"
    print_message $RED "   - ECPAY_HASH_KEY"
    print_message $RED "   - ECPAY_HASH_IV"
    exit 1
fi

if [[ "$ECPAY_RETURN_URL" != https://* ]]; then
    print_message $RED "❌ ECPAY_RETURN_URL 必須使用 HTTPS"
    exit 1
fi

print_message $GREEN "✅ ECPay 配置驗證通過"

# 4. 構建生產映像
print_message $YELLOW "🏗️  構建生產環境映像..."

docker build -f Dockerfile.production -t auto-payment-system:latest .

if [ $? -eq 0 ]; then
    print_message $GREEN "✅ 映像構建成功"
else
    print_message $RED "❌ 映像構建失敗"
    exit 1
fi

# 5. 創建必要的目錄和文件
print_message $YELLOW "📁 創建必要的目錄..."

mkdir -p logs
mkdir -p uploads
mkdir -p ssl
mkdir -p nginx/conf.d
mkdir -p monitoring

# 6. 停止現有容器（如果存在）
print_message $YELLOW "⏹️  停止現有服務..."

docker-compose -f docker-compose.production.yml down --remove-orphans

# 7. 啟動生產服務
print_message $YELLOW "🚀 啟動生產服務..."

docker-compose -f docker-compose.production.yml up -d

if [ $? -eq 0 ]; then
    print_message $GREEN "✅ 服務啟動成功"
else
    print_message $RED "❌ 服務啟動失敗"
    exit 1
fi

# 8. 等待服務就緒
print_message $YELLOW "⏳ 等待服務就緒..."

sleep 30

# 9. 健康檢查
print_message $YELLOW "🔍 執行健康檢查..."

# 檢查應用程式健康狀態
if curl -f -s http://localhost/health > /dev/null; then
    print_message $GREEN "✅ 應用程式健康檢查通過"
else
    print_message $RED "❌ 應用程式健康檢查失敗"
    print_message $YELLOW "檢查日誌："
    docker-compose -f docker-compose.production.yml logs app
    exit 1
fi

# 檢查資料庫連接
if docker-compose -f docker-compose.production.yml exec -T mongodb mongosh --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
    print_message $GREEN "✅ 資料庫連接正常"
else
    print_message $RED "❌ 資料庫連接失敗"
    exit 1
fi

# 10. 顯示部署資訊
print_message $GREEN "🎉 部署完成！"
print_message $BLUE "=================================================="
print_message $BLUE "服務資訊："
print_message $BLUE "- 應用程式: http://localhost (HTTP) / https://localhost (HTTPS)"
print_message $BLUE "- 健康檢查: http://localhost/health"
print_message $BLUE "- ECPay Webhook: http://localhost/api/webhooks/ecpay"
print_message $BLUE "- MongoDB: localhost:27017"
print_message $BLUE "- Redis: localhost:6379"

if docker ps | grep -q "auto-payment-grafana-prod"; then
    print_message $BLUE "- Grafana 監控: http://localhost:3001"
fi

if docker ps | grep -q "auto-payment-prometheus-prod"; then
    print_message $BLUE "- Prometheus: http://localhost:9090"
fi

print_message $BLUE "=================================================="
print_message $YELLOW "重要提醒："
print_message $YELLOW "1. 確保防火牆已開放必要端口 (80, 443)"
print_message $YELLOW "2. 設定 SSL 憑證 (將憑證放入 ssl/ 目錄)"
print_message $YELLOW "3. 在綠界後台設定正確的回調 URL"
print_message $YELLOW "4. 定期備份資料庫和日誌文件"
print_message $YELLOW "5. 監控系統資源使用狀況"

print_message $GREEN "✅ ECPay 自動支付系統部署完成！"
