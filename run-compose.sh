#!/bin/bash

# ECPay 自動支付系統 - Docker Compose 運行腳本
# ECPay Auto Payment System - Docker Compose Runner

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_message $BLUE "🚀 ECPay 自動支付系統 - Docker Compose 啟動"
print_message $BLUE "================================================"

# 1. 環境配置檢查和設定
setup_environment() {
    print_message $YELLOW "🔧 檢查環境配置..."
    
    # 檢查並複製環境配置文件
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            print_message $YELLOW "📋 複製環境配置文件..."
            cp .env.example .env
            print_message $GREEN "✅ 已創建 .env 文件"
        else
            print_message $RED "❌ 找不到 .env.example 文件"
            exit 1
        fi
    fi
    
    # 詢問環境類型（如果是交互式執行）
    if [ -t 0 ] && [ -z "$AUTO_ENV" ]; then
        print_message $YELLOW "🔧 請選擇環境類型："
        echo "1) 開發環境 (development) - 使用 docker-compose.yml"
        echo "2) 生產環境 (production) - 使用 docker-compose.production.yml"
        read -p "請輸入選擇 (1-2): " choice
        
        case $choice in
            1)
                ENV_TYPE="development"
                COMPOSE_FILE="docker-compose.yml"
                ;;
            2)
                ENV_TYPE="production"
                COMPOSE_FILE="docker-compose.production.yml"
                ;;
            *)
                print_message $YELLOW "⚠️  無效選擇，預設使用開發環境"
                ENV_TYPE="development"
                COMPOSE_FILE="docker-compose.yml"
                ;;
        esac
    else
        # 非交互式或設定了 AUTO_ENV
        ENV_TYPE=${AUTO_ENV:-"development"}
        if [ "$ENV_TYPE" = "production" ]; then
            COMPOSE_FILE="docker-compose.production.yml"
        else
            COMPOSE_FILE="docker-compose.yml"
        fi
    fi
    
    # 更新 NODE_ENV
    if [ "$(grep 'NODE_ENV=' .env | cut -d= -f2)" != "$ENV_TYPE" ]; then
        sed -i.bak "s/NODE_ENV=.*/NODE_ENV=$ENV_TYPE/" .env && rm .env.bak 2>/dev/null || true
        print_message $GREEN "✅ 已更新 NODE_ENV 為 $ENV_TYPE"
    fi
    
    print_message $GREEN "✅ 環境設定完成：$ENV_TYPE"
}

# 2. 網路設定
setup_network() {
    print_message $YELLOW "🌐 設定網路環境..."
    
    # Local IPv4
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        LOCAL_IPV4=$(ifconfig | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
    else
        # Ubuntu/Linux
        LOCAL_IPV4=$(hostname -I | awk '{print $1}')
    fi
    
    export LOCAL_IPV4
    print_message $GREEN "✅ 本地 IPv4 地址: $LOCAL_IPV4"
}

# 3. 專案資訊設定
setup_project_info() {
    print_message $YELLOW "📦 讀取專案資訊..."
    
    # 從 package.json 中取得版本、專案名稱
    export IMAGE_ID=$(grep '"name"' package.json | sed -E 's/.*"name": "(.*)".*/\1/')
    export IMAGE_TAG=$(grep '"version"' package.json | sed -E 's/.*"version": "(.*)".*/\1/')
    
    IMAGE_NAME="$IMAGE_ID:$IMAGE_TAG"
    
    print_message $GREEN "✅ 專案名稱: $IMAGE_ID"
    print_message $GREEN "✅ 版本標籤: $IMAGE_TAG"
}

# 4. ECPay 配置驗證
validate_ecpay_config() {
    if [ "$ENV_TYPE" = "production" ]; then
        print_message $YELLOW "🏦 驗證 ECPay 生產環境配置..."
        
        source .env
        if [ -z "$ECPAY_MERCHANT_ID" ] || [ "$ECPAY_MERCHANT_ID" = "2000132" ]; then
            print_message $RED "❌ 生產環境必須設定正式的 ECPay 商店代號"
            print_message $YELLOW "請編輯 .env 文件並設定："
            print_message $YELLOW "- ECPAY_MERCHANT_ID=您的正式商店代號"
            print_message $YELLOW "- ECPAY_HASH_KEY=您的正式 HashKey"
            print_message $YELLOW "- ECPAY_HASH_IV=您的正式 HashIV"
            exit 1
        fi
        
        if [[ "$ECPAY_RETURN_URL" != https://* ]]; then
            print_message $RED "❌ 生產環境的 ECPAY_RETURN_URL 必須使用 HTTPS"
            exit 1
        fi
        
        print_message $GREEN "✅ ECPay 生產環境配置驗證通過"
    else
        print_message $GREEN "✅ 使用 ECPay 測試環境配置"
    fi
}

# 5. Docker 容器啟動
start_containers() {
    print_message $YELLOW "🐳 啟動 Docker 容器..."
    
    # 檢查映像是否存在
    if docker images | grep -q "$IMAGE_NAME"; then
        print_message $GREEN "✅ 映像 $IMAGE_NAME 已存在，直接啟動"
        docker compose -f "$COMPOSE_FILE" up -d
    else
        print_message $YELLOW "🏗️  映像 $IMAGE_NAME 不存在，開始建構"
        docker compose -f "$COMPOSE_FILE" up --build -d
    fi
}

# 6. 健康檢查
health_check() {
    print_message $YELLOW "🔍 等待服務啟動..."
    sleep 10
    
    # 檢查應用程式健康狀態
    local port=3000
    if [ "$ENV_TYPE" = "production" ]; then
        port=80
    fi
    
    if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
        print_message $GREEN "✅ 應用程式健康檢查通過"
    else
        print_message $YELLOW "⚠️  健康檢查失敗，請檢查服務狀態"
        docker compose -f "$COMPOSE_FILE" ps
    fi
}

# 7. 顯示服務資訊
show_service_info() {
    print_message $GREEN "🎉 服務啟動完成！"
    print_message $BLUE "================================================"
    print_message $BLUE "服務資訊："
    
    if [ "$ENV_TYPE" = "production" ]; then
        print_message $BLUE "- 應用程式: http://localhost (HTTP) / https://localhost (HTTPS)"
        print_message $BLUE "- 健康檢查: http://localhost/health"
        print_message $BLUE "- ECPay Webhook: http://localhost/api/webhooks/ecpay"
    else
        print_message $BLUE "- 應用程式: http://localhost:3000"
        print_message $BLUE "- 健康檢查: http://localhost:3000/health"
        print_message $BLUE "- ECPay Webhook: http://localhost:3000/api/webhooks/ecpay"
        print_message $BLUE "- API 文檔: http://localhost:3000/api"
    fi
    
    print_message $BLUE "- MongoDB: localhost:27017"
    print_message $BLUE "- 本地 IP: $LOCAL_IPV4"
    print_message $BLUE "================================================"
    print_message $YELLOW "常用指令："
    print_message $YELLOW "- 查看日誌: docker compose -f $COMPOSE_FILE logs -f"
    print_message $YELLOW "- 停止服務: docker compose -f $COMPOSE_FILE down"
    print_message $YELLOW "- 重啟服務: docker compose -f $COMPOSE_FILE restart"
}

# 主程序
main() {
    setup_environment
    setup_network
    setup_project_info
    validate_ecpay_config
    start_containers
    health_check
    show_service_info
}

# 執行主程序
main "$@"
