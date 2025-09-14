import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { PaymentRepository } from '../../../infra/repositories/payment.repository';
import { SubscriptionRepository } from '../../../infra/repositories/subscription.repository';
import { RetryStrategyEngine } from '../rules-engine/retry-strategy.engine';
import { PaymentProcessingService } from '../../services/payment-processing.service';
import { PaymentEntity } from '../../entities';
import { PaymentFailureCategory } from '../../enums/codes.const';

class InMemoryPaymentRepository {
  private store = new Map<string, PaymentEntity>();
  async save(entity: PaymentEntity) {
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
}

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
  async findByCustomerId(_customerId: string) {
    void _customerId;
    return [];
  }
  async findDueForBilling() {
    return [];
  }
  async countSubscriptions() {
    return 0;
  }
}

describe('PaymentService retryState write-back', () => {
  let moduleRef: TestingModule;
  let service: PaymentService;
  let payments: InMemoryPaymentRepository;

  const subscriptionId = 'sub_sync_1';
  const paymentId = 'pay_sync_1';

  function buildPaymentEntity(): PaymentEntity {
    const start = new Date();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const p = new PaymentEntity(subscriptionId, 'cust_sync', 'pm_sync', 2000, start, end, 'TWD');
    p.id = paymentId;
    return p;
  }

  beforeEach(async () => {
    payments = new InMemoryPaymentRepository();

    const retryEngineStub = {
      evaluateRetryDecision: jest.fn(async (ctx: any) => ({
        shouldRetry: ctx.attemptNumber < 2,
        nextRetryDate: new Date(Date.now() + 50),
        retryStrategy: 'LINEAR',
        maxRetries: 2,
        delayMinutes: 0,
        escalateToManual: false,
        notifyCustomer: false,
        reason: 'stub',
        appliedRules: [],
      })),
    } as Partial<RetryStrategyEngine> as RetryStrategyEngine;

    const processingStub = {
      processPayment: jest.fn(),
    } as Partial<PaymentProcessingService> as PaymentProcessingService;

    moduleRef = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: payments },
        { provide: SubscriptionRepository, useClass: InMemorySubscriptionRepository },
        { provide: RetryStrategyEngine, useValue: retryEngineStub },
        { provide: PaymentProcessingService, useValue: processingStub },
      ],
    }).compile();

    service = moduleRef.get(PaymentService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('writes retryState with decision on failure path (non-throw)', async () => {
    const p = buildPaymentEntity();
    p.startAttempt();
    await payments.save(p);

    const processing = moduleRef.get<PaymentProcessingService>(PaymentProcessingService);
    jest.spyOn(processing, 'processPayment').mockResolvedValue({ success: false, errorMessage: 'Network timeout', failureCategory: PaymentFailureCategory.RETRIABLE } as any);

    const result = await service.processPaymentWithRetry({
      paymentId,
      customerId: 'cust_sync',
      paymentMethodId: 'pm_sync',
      amount: 2000,
      currency: 'TWD',
    });

    expect(result.success).toBe(false);
    const saved = await payments.findById(paymentId);
    expect(saved?.retryState).toBeDefined();
    expect(saved?.retryState?.attemptNumber).toBeGreaterThanOrEqual(1);
    expect(saved?.retryState?.maxRetries).toBe(2);
    expect(saved?.retryState?.nextRetryAt).toBeInstanceOf(Date);
    expect(saved?.retryState?.failureCategory).toBe(PaymentFailureCategory.RETRIABLE);
  });

  it('writes retryState on thrown processing error path', async () => {
    const p = buildPaymentEntity();
    p.startAttempt();
    await payments.save(p);

    const processing = moduleRef.get<PaymentProcessingService>(PaymentProcessingService);
    jest.spyOn(processing, 'processPayment').mockRejectedValue(new Error('Gateway down'));

    const result = await service.processPaymentWithRetry({
      paymentId,
      customerId: 'cust_sync',
      paymentMethodId: 'pm_sync',
      amount: 2000,
      currency: 'TWD',
    });

    expect(result.success).toBe(false);
    const saved = await payments.findById(paymentId);
    expect(saved?.retryState).toBeDefined();
    expect(saved?.retryState?.failureCategory).toBe(PaymentFailureCategory.DELAYED_RETRY);
    expect(saved?.retryState?.attemptNumber).toBeGreaterThanOrEqual(1);
  });
});
