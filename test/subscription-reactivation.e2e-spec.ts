import { Test, TestingModule } from '@nestjs/testing';
import { BusinessRulesEngineModule } from '../src/domain/services/rules-engine/business-rules-engine.module';
import { BillingService } from '../src/domain/services/billing.service';
import { PaymentService } from '../src/domain/services/payment.service';
import { SubscriptionService } from '../src/domain/services/subscription.service';
import { DateCalculationService } from '../src/domain/services/date-calculation/date-calculation.service';
import { PaymentProcessingService } from '../src/domain/services/payment-processing.service';
import { PaymentGatewayManager } from '../src/domain/services/payment/payment-gateway-manager.service';
import { SubscriptionRepository } from '../src/infra/repositories/subscription.repository';
import { PaymentRepository } from '../src/infra/repositories/payment.repository';
import { PaymentMethodRepository } from '../src/infra/repositories/payment-method.repository';
import { SubscriptionEntity } from '../src/domain/entities/subscription.entity';
import { BillingCycle, SubscriptionStatus } from '../src/domain/entities';

class InMemorySubscriptionRepository {
  private store = new Map<string, any>();
  async save(entity: any) {
    if (!entity.id) entity.id = `sub_${this.store.size + 1}`;
    this.store.set(entity.id, entity);
    return entity;
  }
  async findById(id: string) {
    return this.store.get(id) || null;
  }
  async findDueForBilling() {
    return [];
  }
  async findByCustomerId() {
    return [];
  }
  async countSubscriptions() {
    return this.store.size;
  }
}

class InMemoryPaymentRepository {
  private store = new Map<string, any>();
  async save(entity: any) {
    if (!entity.id) entity.id = `pay_${this.store.size + 1}`;
    this.store.set(entity.id, entity);
    return entity;
  }
  async findById(id: string) {
    return this.store.get(id) || null;
  }
  async findBySubscriptionId(subscriptionId: string) {
    return Array.from(this.store.values()).filter((p) => p.subscriptionId === subscriptionId);
  }
  async findByStatus() {
    return [];
  }
}

class StubPaymentMethodRepository {
  async findById(_id: string) {
    return { id: _id, customerId: 'cus_test', type: 'CREDIT_CARD', isAvailable: () => true } as any;
  }
}

class StubGatewayManager {
  processPayment = jest.fn();
  registerGateway() {}
  setDefaultGateway() {}
}

describe('Subscription reactivation requires metadata.paymentResolved (e2e-lite)', () => {
  let moduleRef: TestingModule;
  let billing: BillingService;
  let subs: InMemorySubscriptionRepository;
  let payments: InMemoryPaymentRepository;

  beforeAll(async () => {
    subs = new InMemorySubscriptionRepository();
    payments = new InMemoryPaymentRepository();

    moduleRef = await Test.createTestingModule({
      imports: [BusinessRulesEngineModule],
      providers: [
        BillingService,
        SubscriptionService,
        DateCalculationService,
        PaymentProcessingService,
        { provide: PaymentGatewayManager, useClass: StubGatewayManager },
        { provide: SubscriptionRepository, useValue: subs },
        { provide: PaymentRepository, useValue: payments },
        { provide: PaymentMethodRepository, useClass: StubPaymentMethodRepository },
        PaymentService,
      ],
    }).compile();

    billing = moduleRef.get(BillingService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('GRACE_PERIOD → ACTIVE requires paymentResolved metadata (via handlePaymentSuccess)', async () => {
    const sub = new SubscriptionEntity('cust_g', 'pm_g', 'Basic', 1000, BillingCycle.MONTHLY);
    sub.activate({ reason: 'init', metadata: { paymentSuccessful: true } });
    // 進入 GRACE（手動，因為 failure handler 會立刻轉 PAST_DUE）
    const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    sub.enterGracePeriod(graceEnd);
    await subs.save(sub);

    // 沒有 metadata 直接嘗試轉 ACTIVE 會被守門條件擋下（回傳 invalid，而非 throw）
    const invalid1 = sub.transitionToStatus(SubscriptionStatus.ACTIVE, { reason: 'no metadata' });
    expect(invalid1.isValid).toBe(false);

    // 準備一筆付款紀錄（任意，但需綁定訂閱）
    const paymentService = moduleRef.get(PaymentService);
    const pay = await paymentService.createPayment(sub.id!, sub.customerId, sub.paymentMethodId, 1000, 'TWD', 'test');

    // 成功處理後，BillingService 會帶入 metadata.paymentResolved
    await billing.handlePaymentSuccess(pay.id);

    const updated = await subs.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('RETRY → ACTIVE requires paymentResolved metadata (via handlePaymentSuccess)', async () => {
    const sub = new SubscriptionEntity('cust_r', 'pm_r', 'Basic', 1000, BillingCycle.MONTHLY);
    sub.activate({ reason: 'init', metadata: { paymentSuccessful: true } });
    sub.enterRetryState(new Date(Date.now() + 60 * 1000));
    await subs.save(sub);

    const invalid2 = sub.transitionToStatus(SubscriptionStatus.ACTIVE, { reason: 'no metadata' });
    expect(invalid2.isValid).toBe(false);

    const paymentService = moduleRef.get(PaymentService);
    const pay = await paymentService.createPayment(sub.id!, sub.customerId, sub.paymentMethodId, 1000, 'TWD', 'test');

    await billing.handlePaymentSuccess(pay.id);

    const updated = await subs.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
    // 重新啟用後應重置重試狀態
    expect(updated.retryState?.retryCount).toBe(0);
    expect(updated.retryState?.nextRetryDate).toBeUndefined();
  });

  it('PAST_DUE → ACTIVE requires paymentResolved metadata (via handlePaymentSuccess)', async () => {
    const sub = new SubscriptionEntity('cust_p', 'pm_p', 'Basic', 1000, BillingCycle.MONTHLY);
    sub.activate({ reason: 'init', metadata: { paymentSuccessful: true } });
    // 進入 PAST_DUE（帶上 paymentFailed 模擬規則流程）
    sub.transitionToStatus(SubscriptionStatus.PAST_DUE, { reason: 'failed', metadata: { paymentFailed: true } });
    await subs.save(sub);

    const invalid3 = sub.transitionToStatus(SubscriptionStatus.ACTIVE, { reason: 'no metadata' });
    expect(invalid3.isValid).toBe(false);

    const paymentService = moduleRef.get(PaymentService);
    const pay = await paymentService.createPayment(sub.id!, sub.customerId, sub.paymentMethodId, 1000, 'TWD', 'test');

    await billing.handlePaymentSuccess(pay.id);

    const updated = await subs.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
