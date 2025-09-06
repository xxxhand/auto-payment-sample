# 業務流程圖 (Activity Flow)

本文件定義自動扣款系統的主要業務流程，包含核心的活動流程圖和關鍵決策點。

## 1. 訂閱創建流程 (Subscription Creation Flow)

### 1.1 流程圖

```mermaid
flowchart TD
    A[用戶提交訂閱請求] --> B{驗證用戶資料}
    B -->|失敗| C[返回錯誤訊息]
    B -->|成功| D{驗證產品方案}
    D -->|產品不存在| C
    D -->|成功| E{檢查優惠碼}
    E -->|無效| C
    E -->|有效/無優惠碼| F[計算訂閱費用]
    F --> G[建立訂閱記錄]
    G --> H[執行首次扣款]
    H -->|失敗| I[標記訂閱為FAILED]
    H -->|成功| J[啟用訂閱服務]
    J --> K[建立下次扣款排程]
    K --> L[發送確認通知]
    L --> M[完成訂閱創建]
    I --> N[記錄失敗原因]
    N --> O[發送失敗通知]
```

### 1.2 關鍵決策點

| 決策點 | 條件 | 動作 | 後續流程 |
|---------|------|------|----------|
| 驗證用戶資料 | 用戶身份、支付方式有效 | 繼續流程 | 驗證產品方案 |
| 驗證產品方案 | 產品存在且可訂閱 | 繼續流程 | 檢查優惠碼 |
| 檢查優惠碼 | 優惠碼有效且可使用 | 應用優惠 | 計算費用 |
| 首次扣款 | 支付成功 | 啟用服務 | 建立排程 |

## 2. 自動扣款流程 (Auto Billing Flow)

### 2.1 流程圖

```mermaid
flowchart TD
    A[排程觸發扣款] --> B{檢查訂閱狀態}
    B -->|CANCELLED/EXPIRED| C[跳過扣款]
    B -->|PAUSED| D[延後扣款日期]
    B -->|ACTIVE| E{檢查是否有待處理方案變更}
    E -->|有| F[套用新方案]
    E -->|無| G[使用當前方案]
    F --> G
    G --> H{檢查是否有階段優惠}
    H -->|有| I[計算優惠金額]
    H -->|無| J[使用標準金額]
    I --> J
    J --> K[執行扣款]
    K -->|成功| L[更新訂閱資料]
    L --> M[更新下次扣款日期]
    M --> N[發送成功通知]
    N --> O[完成扣款流程]
    K -->|失敗| P[啟動智能重試機制]
```

### 2.2 扣款時機控制

```mermaid
gantt
    title 扣款排程時間線
    dateFormat  YYYY-MM-DD
    section 月費訂閱
    創建訂閱          :done, create, 2024-01-01, 1d
    第1次扣款         :done, bill1, 2024-02-01, 1d
    第2次扣款         :done, bill2, 2024-03-01, 1d
    第3次扣款         :active, bill3, 2024-04-01, 1d
    section 年費訂閱
    創建訂閱          :done, create-y, 2024-01-01, 1d
    年費扣款          :bill-y, 2025-01-01, 1d
```

## 3. 智能重試流程 (Smart Retry Flow)

### 3.1 流程圖

```mermaid
flowchart TD
    A[扣款失敗] --> B[分析失敗原因]
    B --> C{失敗類型判斷}
    C -->|可立即重試| D[RETRIABLE]
    C -->|需延後重試| E[DELAYED_RETRY]
    C -->|不可重試| F[NON_RETRIABLE]
    
    D --> G[等待短間隔]
    E --> H[等待長間隔]
    F --> I[標記訂閱失效]
    
    G --> J[執行重試]
    H --> J
    
    J -->|成功| K[恢復訂閱狀態]
    J -->|失敗| L{檢查重試次數}
    
    L -->|未超限| M[增加重試計數]
    L -->|超限| N{檢查寬限期}
    
    M --> C
    
    N -->|可延長| O[延長寬限期]
    N -->|無法延長| I
    
    O --> P[重置重試計數]
    P --> Q[安排下次扣款]
    
    K --> R[更新扣款日期]
    R --> S[發送成功通知]
    I --> T[發送失效通知]
```

### 3.2 重試策略決策表

| 失敗原因 | 失敗類型 | 重試間隔 | 最大重試次數 | 寬限期策略 |
|---------|---------|---------|-------------|------------|
| 網路逾時 | RETRIABLE | 5分鐘 | 3次 | 不適用 |
| 系統錯誤 | RETRIABLE | 10分鐘 | 3次 | 不適用 |
| 餘額不足 | DELAYED_RETRY | 1天 | 5次 | 延長7天 |
| 卡片過期 | DELAYED_RETRY | 3天 | 3次 | 延長5天 |
| 卡片停用 | NON_RETRIABLE | 不重試 | 0次 | 不適用 |
| 詐欺風險 | NON_RETRIABLE | 不重試 | 0次 | 不適用 |

## 4. 方案轉換流程 (Plan Change Flow)

### 4.1 立即生效流程

```mermaid
flowchart TD
    A[用戶請求方案變更] --> B{驗證變更權限}
    B -->|無權限| C[返回錯誤]
    B -->|有權限| D[計算費用差額]
    D --> E{差額判斷}
    E -->|需補款| F[執行補款]
    E -->|需退款| G[執行退款]
    E -->|無差額| H[直接變更方案]
    
    F -->|成功| I[更新訂閱方案]
    F -->|失敗| J[變更失敗]
    G --> I
    H --> I
    
    I --> K[記錄變更歷史]
    K --> L[調整下次扣款金額]
    L --> M[發送變更通知]
    J --> N[發送失敗通知]
```

### 4.2 下期生效流程

```mermaid
sequenceDiagram
    participant U as User
    participant S as System
    participant DB as Database
    participant PS as Payment Service
    
    U->>S: 請求方案變更(下期生效)
    S->>DB: 檢查當前訂閱
    DB-->>S: 訂閱資料
    S->>S: 驗證變更規則
    S->>DB: 設定待變更方案
    DB-->>S: 更新成功
    S-->>U: 變更預約成功
    
    Note over S: 等待下次扣款日
    
    S->>S: 執行定期扣款
    S->>S: 檢查待變更方案
    S->>PS: 以新方案金額扣款
    PS-->>S: 扣款結果
    S->>DB: 更新方案&記錄歷史
    S->>U: 發送變更生效通知
```

## 5. 訂閱生命週期流程 (Subscription Lifecycle)

### 5.1 狀態轉換圖

```mermaid
stateDiagram-v2
    [*] --> PENDING: 建立訂閱
    PENDING --> ACTIVE: 首次扣款成功
    PENDING --> FAILED: 首次扣款失敗
    FAILED --> [*]: 取消訂閱
    
    ACTIVE --> PAUSED: 用戶暫停
    PAUSED --> ACTIVE: 用戶恢復
    PAUSED --> CANCELLED: 用戶取消
    
    ACTIVE --> CANCELLED: 用戶取消
    ACTIVE --> EXPIRED: 扣款失敗超限
    
    CANCELLED --> [*]: 結束
    EXPIRED --> [*]: 結束
    
    note right of ACTIVE
        正常扣款循環
        - 定期扣款
        - 方案變更
        - 優惠套用
    end note
    
    note right of EXPIRED
        自動失效條件
        - 重試次數耗盡
        - 寬限期結束
    end note
```

### 5.2 生命週期事件觸發

| 狀態 | 觸發事件 | 系統動作 | 通知類型 |
|------|----------|----------|----------|
| PENDING → ACTIVE | 首次扣款成功 | 啟用服務、設定下次扣款 | 歡迎信件 |
| ACTIVE → PAUSED | 用戶暫停 | 暫停扣款排程 | 暫停確認 |
| ACTIVE → EXPIRED | 扣款失敗超限 | 停用服務、清理排程 | 服務終止通知 |
| PAUSED → ACTIVE | 用戶恢復 | 恢復扣款排程 | 服務恢復通知 |

## 6. 排程作業流程 (Scheduled Jobs Flow)

### 6.1 每日排程作業

```mermaid
flowchart TD
    A[每日 00:00 觸發] --> B[掃描當日到期訂閱]
    B --> C{有訂閱需處理}
    C -->|否| D[結束作業]
    C -->|是| E[按批次處理訂閱]
    E --> F[載入一批訂閱]
    F --> G[逐一執行扣款流程]
    G --> H{批次完成}
    H -->|否| F
    H -->|是| I{還有批次}
    I -->|是| E
    I -->|否| J[記錄處理結果]
    J --> K[發送作業報告]
    K --> D
```

### 6.2 重試排程作業

```mermaid
flowchart TD
    A[每小時觸發] --> B[掃描重試排程]
    B --> C{有重試任務}
    C -->|否| D[結束作業]
    C -->|是| E[按重試類型分組]
    E --> F[處理 RETRIABLE 類型]
    F --> G[處理 DELAYED_RETRY 類型]
    G --> H[執行重試扣款]
    H --> I[更新重試狀態]
    I --> J[記錄重試結果]
    J --> D
```

這個 Activity Flow 文件涵蓋了系統的主要業務流程。接下來讓我創建自動扣款排程作業的詳細文件。
