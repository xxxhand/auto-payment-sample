/**
 * 智能重試流程 (Smart Retry Flow) 範例程式
 *
 * 目標：依據 docs/architecture/activity-flow.md 中的「3. 智能重試流程」實作一個可執行的示例，
 *       並以「可讀性高的註解」清楚對應流程圖各節點與決策。
 *
 * 對應文件：docs/architecture/activity-flow.md → 3. 智能重試流程
 * 流程圖節點對照：
 *  A[扣款失敗] → B[分析失敗原因] → C{失敗類型判斷}
 *   ├─ 可立即重試 → D[RETRIABLE] → G[等待短間隔] → J[執行重試]
 *   ├─ 需延後重試 → E[DELAYED_RETRY] → H[等待長間隔] → J[執行重試]
 *   └─ 不可重試   → F[NON_RETRIABLE] → I[標記訂閱失效]
 *
 *  J →|成功| K[恢復訂閱狀態] → R[更新扣款日期] → S[發送成功通知]
 *  J →|失敗| L{檢查重試次數}
 *      ├─ 未超限 → M[增加重試計數] → C（再次判斷）
 *      └─ 超限   → N{檢查寬限期}
 *                    ├─ 可延長 → O[延長寬限期] → P[重置重試計數] → Q[安排下次扣款]
 *                    └─ 無法延長 → I[標記訂閱失效]
 *
 * 說明：
 * - 本範例重點在於展示「重試決策與排程」如何由 RetryStrategyEngine 決定，
 *   並用豐富註解對應流程圖節點，而非實作完整金流與資料庫。
 * - 程式風格與輸出參考 src/examples/daily-billing-complex.ts。
 */

import { Logger } from '@nestjs/common';
import { SubscriptionStatus, PaymentFailureCategory, RetryStrategyType } from '../domain/enums/codes.const';
import { RuleRegistry } from '../domain/services/rules-engine/rule-registry.service';
import { RetryStrategyEngine, RetryDecisionContext, RetryDecisionResult } from '../domain/services/rules-engine/retry-strategy.engine';

// ===================== 模擬資料結構與狀態 =====================

/**
 * 模擬訂閱狀態與重試資訊（簡化版）
 */
class MockSubscription {
  constructor(
    public readonly subscriptionId: string,
    public status: SubscriptionStatus,
  ) {}

  retry = {
    count: 0,
    max: 5,
    nextRetryDate: undefined as Date | undefined,
    lastAttemptDate: undefined as Date | undefined,
    totalFailureCount: 0,
    graceExtendedDays: 0,
    maxGraceExtensions: 1,
  };
}

/**
 * 模擬支付失敗事件（對應流程 A → B）
 */
interface FailedPaymentEvent {
  subscriptionId: string;
  paymentId: string; // 簡化處理：以 subscriptionId 當 paymentId
  amount: number;
  currency: string;
  customerTier?: string; // 例如 'PREMIUM' 可觸發預設規則
  reason: string; // 失敗原因（e.g. 'NETWORK_TIMEOUT', 'INSUFFICIENT_FUNDS', 'FRAUD_SUSPECTED'）
  category: PaymentFailureCategory; // C{失敗類型判斷} 的結果
}

// ===================== 智能重試處理器 =====================

class SmartRetryProcessor {
  private readonly logger = new Logger(SmartRetryProcessor.name);

  constructor(private readonly engine: RetryStrategyEngine) {}

  /**
   * 核心：以單一事件執行「重試決策 → 排程/終止」的流程
   * - 對應 A/B/C/D/E/F/G/H/J/K/L/M/N/O/P/Q/R/S/I/T 等節點（見上方對照）
   */
  async handleFailure(
    sub: MockSubscription,
    event: FailedPaymentEvent,
  ): Promise<{
    decision: RetryDecisionResult;
    finalStatus: SubscriptionStatus;
  }> {
    // B[分析失敗原因]：組合 RetryStrategyEngine 需要的上下文
    const ctx: RetryDecisionContext = {
      paymentId: event.paymentId,
      subscriptionId: event.subscriptionId,
      paymentAmount: event.amount,
      currency: event.currency,
      failureCategory: event.category,
      failureReason: event.reason,
      attemptNumber: sub.retry.count + 1, // 已完成的重試次數 + 1
      totalFailureCount: sub.retry.totalFailureCount + 1,
      lastAttemptDate: sub.retry.lastAttemptDate || new Date(),
      customerTier: event.customerTier,
      metadata: { example: 'smart-retry-flow' },
    };

    // C{失敗類型判斷} → 交由引擎計算策略與動作
    const decision = await this.engine.evaluateRetryDecision(ctx);

    // 對應 G/H（等待間隔）與 L/M/N/O 路徑的狀態更新與排程
    const { shouldRetry, nextRetryDate, escalateToManual, notifyCustomer } = decision;

    // 更新內部重試統計
    sub.retry.lastAttemptDate = new Date();
    sub.retry.totalFailureCount += 1;

    if (shouldRetry && nextRetryDate) {
      // D/E → G/H → J：允許重試，根據策略安排下次嘗試
      sub.retry.count += 1; // M[增加重試計數]
      sub.retry.nextRetryDate = nextRetryDate; // Q[安排下次扣款]

      // 依策略類型決定狀態（純示意）：
      // - 短間隔（LINEAR 或 FIXED_INTERVAL） → 視為 RETRY
      // - 指數退避（EXPONENTIAL_BACKOFF） → 視為 GRACE_PERIOD（需延後重試）
      if (decision.retryStrategy === RetryStrategyType.EXPONENTIAL_BACKOFF) {
        sub.status = SubscriptionStatus.GRACE_PERIOD; // E/H → J
      } else {
        sub.status = SubscriptionStatus.RETRY; // D/G → J
      }

      this.logger.log(`允許重試 → 訂閱 ${sub.subscriptionId} 狀態 ${sub.status}，第 ${sub.retry.count} 次；下次重試：${nextRetryDate.toISOString()}`);

      if (notifyCustomer) {
        // 可對應流程中的通知節點（如 S/T）
        this.logger.log(`通知用戶：付款問題仍在處理中（已安排重試）。`);
      }
    } else {
      // F/I：不可重試或規則要求終止（含立即升級人工處理）
      sub.status = SubscriptionStatus.EXPIRED; // 示例：直接標記失效（實務可切換到 PAST_DUE/EXPIRED/CANCELED 視業務需求）
      sub.retry.nextRetryDate = undefined;

      const reasons: string[] = [decision.reason];
      if (escalateToManual) reasons.push('需要人工處理');
      if (notifyCustomer) reasons.push('需通知用戶');

      this.logger.warn(`停止重試 → 訂閱 ${sub.subscriptionId} 已標記為 ${sub.status}（${reasons.join(' / ')}）`);
    }

    return { decision, finalStatus: sub.status };
  }
}

// ===================== 示範執行（可直接 node-ts 跑起來） =====================

(async function main() {
  const logger = new Logger('SmartRetryDemo');
  logger.log('初始化規則註冊表與重試引擎...');

  // 建立規則註冊表與重試策略引擎（引擎會註冊預設規則）
  const registry = new RuleRegistry();
  const engine = new RetryStrategyEngine(registry);
  const processor = new SmartRetryProcessor(engine);

  // 建立模擬訂閱
  const subs: Record<string, MockSubscription> = {
    sub_retriable_1: new MockSubscription('sub_retriable_1', SubscriptionStatus.ACTIVE),
    sub_retriable_2: new MockSubscription('sub_retriable_2', SubscriptionStatus.ACTIVE),
    sub_delayed_1: new MockSubscription('sub_delayed_1', SubscriptionStatus.ACTIVE),
    sub_delayed_2_premium: new MockSubscription('sub_delayed_2_premium', SubscriptionStatus.ACTIVE),
    sub_non_retriable_fraud: new MockSubscription('sub_non_retriable_fraud', SubscriptionStatus.ACTIVE),
    sub_high_amount_escalate: new MockSubscription('sub_high_amount_escalate', SubscriptionStatus.ACTIVE),
  };

  // 模擬「扣款失敗事件」清單（對應 A → B → C）
  const events: FailedPaymentEvent[] = [
    // RETRIABLE：網路逾時 → 短間隔重試
    {
      subscriptionId: 'sub_retriable_1',
      paymentId: 'sub_retriable_1',
      amount: 500,
      currency: 'TWD',
      reason: 'NETWORK_TIMEOUT',
      category: PaymentFailureCategory.RETRIABLE,
    },
    // RETRIABLE：系統錯誤，第 2 次嘗試
    {
      subscriptionId: 'sub_retriable_2',
      paymentId: 'sub_retriable_2',
      amount: 800,
      currency: 'TWD',
      reason: 'SYSTEM_ERROR',
      category: PaymentFailureCategory.RETRIABLE,
    },
    // DELAYED_RETRY：餘額不足 → 長間隔重試
    {
      subscriptionId: 'sub_delayed_1',
      paymentId: 'sub_delayed_1',
      amount: 5800,
      currency: 'TWD',
      reason: 'INSUFFICIENT_FUNDS',
      category: PaymentFailureCategory.DELAYED_RETRY,
    },
    // DELAYED_RETRY + PREMIUM 客戶 → 預設規則將延長可重試上限
    {
      subscriptionId: 'sub_delayed_2_premium',
      paymentId: 'sub_delayed_2_premium',
      amount: 3000,
      currency: 'TWD',
      reason: 'CARD_EXPIRED',
      category: PaymentFailureCategory.DELAYED_RETRY,
      customerTier: 'PREMIUM',
    },
    // NON_RETRIABLE：疑似詐欺 → 強制不重試並升級人工
    {
      subscriptionId: 'sub_non_retriable_fraud',
      paymentId: 'sub_non_retriable_fraud',
      amount: 1200,
      currency: 'TWD',
      reason: 'FRAUD_SUSPECTED',
      category: PaymentFailureCategory.NON_RETRIABLE,
    },
    // 高額 + 多次失敗 → 預設規則觸發 IMMEDIATE_ESCALATION
    {
      subscriptionId: 'sub_high_amount_escalate',
      paymentId: 'sub_high_amount_escalate',
      amount: 15000,
      currency: 'TWD',
      reason: 'SYSTEM_ERROR',
      category: PaymentFailureCategory.RETRIABLE,
    },
  ];

  // 預先調整某些訂閱的重試次數，以觸發不同決策（例如高額場景需要 attempt > 2）
  subs.sub_high_amount_escalate.retry.count = 3; // 已嘗試 3 次

  // 執行處理
  logger.log(`開始處理 ${events.length} 個失敗事件，模擬智能重試流程...`);

  type Row = {
    訂閱ID: string;
    類別: string;
    原因: string;
    應重試: string;
    下次重試: string;
    策略: string;
    升級人工: string;
    通知用戶: string;
    最終狀態: string;
    套用規則數: number;
  };
  const table: Row[] = [];

  for (const ev of events) {
    const sub = subs[ev.subscriptionId];

    logger.log(`\n[A] 扣款失敗 → [B] 分析原因=${ev.reason}, 類別=${PaymentFailureCategory[ev.category]}`);

    const { decision, finalStatus } = await processor.handleFailure(sub, ev);

    // 彙整輸出（對應 K/R/S 或 I/T 等節點的摘要）
    table.push({
      訂閱ID: ev.subscriptionId,
      類別: PaymentFailureCategory[ev.category],
      原因: ev.reason,
      應重試: decision.shouldRetry ? '是' : '否',
      下次重試: decision.nextRetryDate ? decision.nextRetryDate.toISOString().slice(0, 16) : '-',
      策略: RetryStrategyType[decision.retryStrategy],
      升級人工: decision.escalateToManual ? '是' : '否',
      通知用戶: decision.notifyCustomer ? '是' : '否',
      最終狀態: SubscriptionStatus[finalStatus],
      套用規則數: decision.metadata?.appliedRules ?? 0,
    });
  }

  logger.log('\n' + '='.repeat(120));
  logger.log(' '.repeat(48) + '智能重試流程 - 摘要報告');
  logger.log('='.repeat(120));
  console.table(table);
  logger.log('='.repeat(120) + '\n');
})().catch((err) => {
  // T[發送失效通知] 可在此模擬（本示例僅輸出錯誤）
  // eslint-disable-next-line no-console
  console.error('執行智能重試範例時發生錯誤：', err);
  process.exit(1);
});
