# ECPay 自動支付系統 / ECPay Auto Payment System

🚀 基於 NestJS 和綠界科技 (ECPay) 的企業級自動支付解決方案

## 🌟 主要特色

- ✅ **完整的 ECPay 整合** - 支援信用卡、ATM、超商代碼等多種支付方式
- 🏗️ **模組化架構** - 基於 NestJS 的企業級架構設計
- 🔧 **智能閘道管理** - 支援多支付閘道智能選擇和容錯處理
- 🔒 **安全可靠** - 完整的檢查碼驗證和 HTTPS 支援
- 📊 **生產級監控** - 健康檢查、日誌管理、Prometheus 監控
- 🐳 **容器化部署** - Docker Compose 一鍵部署
- 🧪 **完整測試** - E2E 測試覆蓋和自動化 CI/CD

## 🚀 快速開始

### 1. 環境需求

- Node.js 18+ 
- Docker & Docker Compose
- MongoDB (可選，Docker 會自動啟動)

### 2. 一鍵啟動

```bash
# 克隆專案
git clone https://github.com/xxxhand/auto-payment-sample.git
cd auto-payment-sample

# 一鍵啟動 (會自動處理環境設定)
./run-compose.sh
```

腳本會自動：
- 🔧 檢查並創建環境配置文件
- 🏗️ 建構 Docker 映像
- 🐳 啟動所有服務容器
- 🔍 執行健康檢查
- 📊 顯示服務資訊

### 3. 環境選擇

腳本啟動時會詢問環境類型：
- **開發環境** - 使用測試 ECPay 帳號，適合開發和測試
- **生產環境** - 需要設定正式 ECPay 商店資訊

### 4. 服務端點

**開發環境：**
- 🌐 應用程式：http://localhost:3000
- ❤️ 健康檢查：http://localhost:3000/health
- 🔔 ECPay Webhook：http://localhost:3000/api/webhooks/ecpay
- 📚 API 文檔：http://localhost:3000/api

**生產環境：**
- 🌐 應用程式：http://localhost (HTTPS 可用)
- ❤️ 健康檢查：http://localhost/health
- 🔔 ECPay Webhook：https://localhost/api/webhooks/ecpay

## ⚙️ 環境配置

### 自動配置

執行 `./run-compose.sh` 時會自動從 `.env.example` 複製環境配置。

### 手動配置

```bash
# 複製環境配置範本
cp .env.example .env

# 編輯配置文件
vim .env
```

### 重要配置項目

#### ECPay 設定
```bash
# 開發環境 (使用官方測試帳號)
ECPAY_MERCHANT_ID=2000132
ECPAY_HASH_KEY=5294y06JbISpM5x9  
ECPAY_HASH_IV=v77hoKGq4kWxNNIS

# 生產環境 (需要替換為您的正式帳號)
# ECPAY_MERCHANT_ID=your_merchant_id
# ECPAY_HASH_KEY=your_hash_key
# ECPAY_HASH_IV=your_hash_iv

# Webhook URL (生產環境必須使用 HTTPS)
ECPAY_RETURN_URL=https://your-domain.com/api/webhooks/ecpay
```

## 🏗️ 開發指南

### 本地開發

```bash
# 安裝依賴
yarn install

# 啟動開發伺服器
yarn start:dev

# 執行測試
yarn test
yarn test:e2e
```

### 建構和部署

```bash
# 開發環境
./run-compose.sh  # 選擇 1) 開發環境

# 生產環境  
./run-compose.sh  # 選擇 2) 生產環境

# 或使用環境變數自動選擇
AUTO_ENV=production ./run-compose.sh
```

### 常用 Docker 指令

```bash
# 查看服務狀態
docker compose ps

# 查看日誌
docker compose logs -f

# 停止服務
docker compose down

# 重啟服務
docker compose restart

# 清理並重新建構
docker compose down -v
docker compose up --build -d
```

## 🧪 測試

```bash
# 單元測試
yarn test

# E2E 測試
yarn test:e2e

# 測試覆蓋率
yarn test:cov

# ECPay 整合測試
yarn test:e2e --testNamePattern="ECPay"
```

## 📊 監控和日誌

### 健康檢查
- 基本檢查：`GET /health`
- 詳細檢查：`GET /health/detailed`

### 日誌位置
- 應用程式日誌：`./logs/app.log`
- Nginx 日誌：`./logs/nginx/`
- Docker 日誌：`docker compose logs`

### Grafana 監控 (生產環境)
- 訪問：http://localhost:3001
- 預設帳號：admin / admin

## 🔧 ECPay 整合說明

### 支援的支付方式
- 💳 信用卡 (Credit Card)
- 🏧 WebATM / ATM 轉帳
- 🏪 超商代碼 (CVS)
- 📱 超商條碼 (Barcode)
- 🔁 定期定額支付

### Webhook 處理
系統會自動處理 ECPay 的支付結果回調：
- ✅ 自動驗證檢查碼 (CheckMacValue)
- 📝 記錄詳細交易日誌
- 🔄 更新訂單狀態
- 📧 發送通知 (可擴展)

### 測試流程
1. 使用官方測試帳號創建支付
2. 前往測試支付頁面完成付款
3. 系統接收 Webhook 回調
4. 查看日誌確認處理結果

## 📁 專案結構

```
src/
├── controllers/           # 控制器層
│   ├── payments.controller.ts      # 支付 API
│   ├── ecpay-webhook.controller.ts # ECPay Webhook
│   └── health.controller.ts        # 健康檢查
├── domain/
│   ├── services/payment/  # 支付服務
│   │   ├── payment-gateway-manager.service.ts # 閘道管理
│   │   ├── ecpay-gateway.service.ts           # ECPay 閘道
│   │   └── mock-payment-gateway.service.ts    # 測試閘道
│   ├── interfaces/payment/ # 支付介面
│   └── entities/           # 實體模型
├── libs/conf/             # 配置管理
test/                      # 測試文件
docker-compose.yml         # Docker 編排 (開發)
docker-compose.production.yml # Docker 編排 (生產)  
deploy.sh                  # 生產部署腳本
run-compose.sh            # 一鍵啟動腳本
```

## 🔐 安全考量

### 生產環境安全檢查清單
- [ ] 使用正式 ECPay 商店帳號
- [ ] 設定強密碼和金鑰
- [ ] 啟用 HTTPS 和 SSL 憑證
- [ ] 設定防火牆和存取控制
- [ ] 定期備份資料庫
- [ ] 監控系統資源和錯誤日誌
- [ ] 定期更新依賴套件

### Webhook 安全
- 🔒 檢查碼驗證 (CheckMacValue)
- 🌐 IP 白名單 (可選)
- 📝 詳細日誌記錄
- ⚠️ 異常處理和告警

## 📚 API 文檔

啟動服務後訪問 Swagger 文檔：
- 開發環境：http://localhost:3000/api
- 包含完整的 API 規格和測試介面

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權

本專案使用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件

## 🆘 支援

如有問題或需要協助：
- 🐛 [提交 Issue](https://github.com/xxxhand/auto-payment-sample/issues)
- 📧 聯繫開發團隊
- 📖 查閱 [ECPay 官方文檔](https://developers.ecpay.com.tw/)

---

⭐ 如果這個專案對您有幫助，請給我們一顆星星！