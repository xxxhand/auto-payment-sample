import { Injectable } from '@nestjs/common';

export interface Refund {
  id: string;
  customerId: string;
  subscriptionId?: string;
  paymentId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  refundMethod: 'ORIGINAL_PAYMENT' | 'BANK_TRANSFER' | 'STORE_CREDIT';
  metadata: {
    originalPaymentMethod: string;
    refundReference?: string;
    processingDetails?: string;
    adminNotes?: string;
  };
}

export interface RefundPolicy {
  productId: string;
  refundable: boolean;
  refundPeriodDays: number;
  fullRefundPeriodDays?: number;
  partialRefundAllowed: boolean;
  conditions: string[];
}

/**
 * 退款管理服務
 * 負責處理退款申請、審核和執行
 */
@Injectable()
export class RefundService {
  private readonly refunds: Refund[] = [
    {
      id: 'refund_001',
      customerId: 'cust_123',
      subscriptionId: 'sub_premium_001',
      paymentId: 'pay_001',
      amount: 999,
      currency: 'TWD',
      reason: 'Service dissatisfaction',
      status: 'COMPLETED',
      requestedAt: '2024-01-15T10:30:00Z',
      processedAt: '2024-01-15T14:00:00Z',
      completedAt: '2024-01-16T09:00:00Z',
      refundMethod: 'ORIGINAL_PAYMENT',
      metadata: {
        originalPaymentMethod: 'credit_card',
        refundReference: 'REF_20240115_001',
        processingDetails: 'Refunded to original credit card',
      },
    },
    {
      id: 'refund_002',
      customerId: 'cust_456',
      subscriptionId: 'sub_basic_002',
      amount: 299,
      currency: 'TWD',
      reason: 'Accidental purchase',
      status: 'PROCESSING',
      requestedAt: '2024-01-20T16:45:00Z',
      processedAt: '2024-01-21T09:00:00Z',
      refundMethod: 'ORIGINAL_PAYMENT',
      metadata: {
        originalPaymentMethod: 'credit_card',
        processingDetails: 'Processing refund to original payment method',
      },
    },
  ];

  private readonly refundPolicies: RefundPolicy[] = [
    {
      productId: 'prod_basic_monthly',
      refundable: true,
      refundPeriodDays: 30,
      fullRefundPeriodDays: 7,
      partialRefundAllowed: true,
      conditions: ['Full refund available within 7 days', 'Partial refund available within 30 days', 'Usage-based calculation applies'],
    },
    {
      productId: 'prod_premium_monthly',
      refundable: true,
      refundPeriodDays: 30,
      fullRefundPeriodDays: 14,
      partialRefundAllowed: true,
      conditions: ['Full refund available within 14 days', 'Partial refund available within 30 days', 'Pro-rated calculation based on usage'],
    },
    {
      productId: 'prod_enterprise_monthly',
      refundable: true,
      refundPeriodDays: 30,
      fullRefundPeriodDays: 30,
      partialRefundAllowed: false,
      conditions: ['Full refund available within 30 days', 'Enterprise support team review required'],
    },
    {
      productId: 'prod_basic_yearly',
      refundable: true,
      refundPeriodDays: 60,
      fullRefundPeriodDays: 30,
      partialRefundAllowed: true,
      conditions: ['Full refund available within 30 days', 'Partial refund available within 60 days', 'Yearly subscription pro-rated calculation'],
    },
  ];

  /**
   * 申請退款
   */
  public async requestRefund(request: {
    customerId: string;
    subscriptionId?: string;
    paymentId?: string;
    orderId?: string;
    amount: number;
    reason: string;
  }): Promise<{ refund: Refund; eligible: boolean; policy?: RefundPolicy }> {
    if (!request.customerId) {
      throw new Error('Customer ID is required');
    }

    if (!request.subscriptionId && !request.paymentId && !request.orderId) {
      throw new Error('Either subscriptionId, paymentId, or orderId is required');
    }

    // 檢查退款資格
    const eligibilityResult = await this.checkRefundEligibility({
      customerId: request.customerId,
      subscriptionId: request.subscriptionId,
      amount: request.amount,
    });

    // 創建退款記錄
    const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRefund: Refund = {
      id: refundId,
      customerId: request.customerId,
      subscriptionId: request.subscriptionId,
      paymentId: request.paymentId,
      orderId: request.orderId,
      amount: request.amount,
      currency: 'TWD',
      reason: request.reason,
      status: eligibilityResult.eligible ? 'PENDING' : 'REJECTED',
      requestedAt: new Date().toISOString(),
      refundMethod: 'ORIGINAL_PAYMENT',
      metadata: {
        originalPaymentMethod: 'credit_card',
        adminNotes: eligibilityResult.eligible ? 'Eligible for refund' : 'Not eligible for refund',
      },
    };

    this.refunds.push(newRefund);

    return {
      refund: newRefund,
      eligible: eligibilityResult.eligible,
      policy: eligibilityResult.policy,
    };
  }

  /**
   * 取得退款狀態
   */
  public async getRefundStatus(refundId: string): Promise<{ refund: Refund | null; history: { timestamp: string; status: string; note?: string }[] }> {
    if (!refundId) {
      throw new Error('Refund ID is required');
    }

    const refund = this.refunds.find((r) => r.id === refundId);
    if (!refund) {
      return { refund: null, history: [] };
    }

    // 模擬退款歷史記錄
    const history = [
      {
        timestamp: refund.requestedAt,
        status: 'REQUESTED',
        note: 'Refund request submitted',
      },
    ];

    if (refund.processedAt) {
      history.push({
        timestamp: refund.processedAt,
        status: 'APPROVED',
        note: 'Refund approved and processing initiated',
      });
    }

    if (refund.completedAt) {
      history.push({
        timestamp: refund.completedAt,
        status: 'COMPLETED',
        note: 'Refund completed successfully',
      });
    }

    return { refund, history };
  }

  /**
   * 取得客戶退款記錄
   */
  public async getCustomerRefunds(customerId: string): Promise<{ refunds: Refund[] }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const customerRefunds = this.refunds.filter((refund) => refund.customerId === customerId).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    return { refunds: customerRefunds };
  }

  /**
   * 檢查退款資格
   */
  public async checkRefundEligibility(request: {
    customerId: string;
    subscriptionId?: string;
    amount: number;
  }): Promise<{ eligible: boolean; policy?: RefundPolicy; reasons: string[] }> {
    const reasons: string[] = [];

    if (!request.subscriptionId) {
      reasons.push('Subscription information required for eligibility check');
      return { eligible: false, reasons };
    }

    // 模擬訂閱資料查詢
    const subscription = {
      id: request.subscriptionId,
      productId: 'prod_basic_monthly',
      createdAt: '2024-01-01T00:00:00Z',
      status: 'ACTIVE',
    };

    if (!subscription) {
      reasons.push('Subscription not found');
      return { eligible: false, reasons };
    }

    // 查找退款政策
    const policy = this.refundPolicies.find((p) => p.productId === subscription.productId);
    if (!policy) {
      reasons.push('No refund policy found for this product');
      return { eligible: false, reasons };
    }

    if (!policy.refundable) {
      reasons.push('Product is not refundable');
      return { eligible: false, policy, reasons };
    }

    // 檢查退款期限
    const subscriptionDate = new Date(subscription.createdAt);
    const daysSinceSubscription = Math.floor((Date.now() - subscriptionDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceSubscription > policy.refundPeriodDays) {
      reasons.push(`Refund period expired (${policy.refundPeriodDays} days limit)`);
      return { eligible: false, policy, reasons };
    }

    // 檢查是否允許部分退款
    if (daysSinceSubscription > (policy.fullRefundPeriodDays || 0) && !policy.partialRefundAllowed) {
      reasons.push('Only full refund period has passed and partial refunds not allowed');
      return { eligible: false, policy, reasons };
    }

    return { eligible: true, policy, reasons: [] };
  }

  /**
   * 計算退款金額
   */
  public async calculateRefundAmount(request: { subscriptionId: string; originalAmount: number }): Promise<{
    refundAmount: number;
    refundType: 'FULL' | 'PARTIAL';
    calculation: { originalAmount: number; usageDays: number; totalPeriodDays: number; refundPercentage: number };
  }> {
    if (!request.subscriptionId) {
      throw new Error('Subscription ID is required');
    }

    // 模擬訂閱資料
    const subscription = {
      id: request.subscriptionId,
      productId: 'prod_basic_monthly',
      createdAt: '2024-01-01T00:00:00Z',
      billingPeriod: 'monthly',
    };

    const policy = this.refundPolicies.find((p) => p.productId === subscription.productId);
    if (!policy) {
      throw new Error('Refund policy not found');
    }

    const subscriptionDate = new Date(subscription.createdAt);
    const daysSinceSubscription = Math.floor((Date.now() - subscriptionDate.getTime()) / (1000 * 60 * 60 * 24));

    // 全額退款期間
    if (daysSinceSubscription <= (policy.fullRefundPeriodDays || 0)) {
      return {
        refundAmount: request.originalAmount,
        refundType: 'FULL',
        calculation: {
          originalAmount: request.originalAmount,
          usageDays: daysSinceSubscription,
          totalPeriodDays: policy.fullRefundPeriodDays || 0,
          refundPercentage: 100,
        },
      };
    }

    // 部分退款計算
    const totalPeriodDays = subscription.billingPeriod === 'monthly' ? 30 : 365;
    const unusedDays = Math.max(0, totalPeriodDays - daysSinceSubscription);
    const refundPercentage = Math.round((unusedDays / totalPeriodDays) * 100);
    const refundAmount = Math.round((request.originalAmount * refundPercentage) / 100);

    return {
      refundAmount,
      refundType: 'PARTIAL',
      calculation: {
        originalAmount: request.originalAmount,
        usageDays: daysSinceSubscription,
        totalPeriodDays,
        refundPercentage,
      },
    };
  }

  /**
   * 處理退款（審核和執行）
   */
  public async processRefund(refundId: string, action: 'APPROVE' | 'REJECT', adminNotes?: string): Promise<{ success: boolean; refund: Refund; message: string }> {
    if (!refundId) {
      throw new Error('Refund ID is required');
    }

    const refund = this.refunds.find((r) => r.id === refundId);
    if (!refund) {
      throw new Error('Refund not found');
    }

    if (refund.status !== 'PENDING') {
      throw new Error(`Cannot process refund in ${refund.status} status`);
    }

    const now = new Date().toISOString();

    if (action === 'APPROVE') {
      refund.status = 'PROCESSING';
      refund.processedAt = now;
      refund.metadata.adminNotes = adminNotes || 'Refund approved';

      // 模擬處理時間後完成
      setTimeout(() => {
        refund.status = 'COMPLETED';
        refund.completedAt = new Date().toISOString();
        refund.metadata.refundReference = `REF_${Date.now()}`;
        refund.metadata.processingDetails = 'Refund processed successfully';
      }, 1000);

      return {
        success: true,
        refund,
        message: 'Refund approved and processing initiated',
      };
    } else {
      refund.status = 'REJECTED';
      refund.processedAt = now;
      refund.metadata.adminNotes = adminNotes || 'Refund rejected';

      return {
        success: true,
        refund,
        message: 'Refund rejected',
      };
    }
  }
}
