import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { PaymentRepository } from '../../../infra/repositories/payment.repository';
import { SubscriptionRepository } from '../../../infra/repositories/subscription.repository';
import { RetryStrategyEngine } from '../rules-engine/retry-strategy.engine';
import { PaymentProcessingService } from '../../services/payment-processing.service';
import { PaymentEntity } from '../../entities';

class InMemoryPaymentRepository {
  private store = new Map<string, PaymentEntity>();

  async save(entity: PaymentEntity) {
    if (!entity.id) {
      entity.id = `pay_${this.store.size + 1}`;
    }
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
    return [] as PaymentEntity[];
  }
}

class InMemorySubscriptionRepository {
  private store = new Map<string, any>();
  async save(entity: any) {
    if (!entity.id) {
      entity.id = `sub_${this.store.size + 1}`;
    }
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

describe('PaymentService.processPaymentWithRetry + RetryStrategyEngine (rule-driven)', () => {
  let moduleRef: TestingModule;
  let service: PaymentService;
  let payments: InMemoryPaymentRepository;

  const subscriptionId = 'sub_rule_1';
  const paymentId = 'pay_rule_1';

  beforeAll(async () => {
    payments = new InMemoryPaymentRepository();

    // 預設 stub：可由各測試用例動態覆寫 evaluateRetryDecision
    const retryEngineStub = {
      evaluateRetryDecision: jest.fn(async () => ({
        shouldRetry: false,
        maxRetries: 0,
        delayMinutes: 0,
        retryStrategy: 'NONE',
        escalateToManual: false,
        notifyCustomer: false,
        reason: 'no-retry',
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

  afterAll(async () => {
    await moduleRef.close();
  });

  function buildPaymentEntity(): PaymentEntity {
    // PaymentEntity(subscriptionId, customerId, paymentMethodId, amount, billingPeriodStart, billingPeriodEnd)
    const start = new Date();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const p = new PaymentEntity(subscriptionId, 'cust_x', 'pm_x', 1000, start, end, 'TWD');
    p.id = paymentId;
    return p;
  }

  it('should succeed fast when gateway succeeds on first attempt', async () => {
    // arrange
    const p = buildPaymentEntity();
    p.startAttempt(); // move to PROCESSING for valid transitions
    await payments.save(p);

    // mock processing service success once
    const processing = moduleRef.get<PaymentProcessingService>(PaymentProcessingService);
    const spy = jest.spyOn(processing, 'processPayment').mockResolvedValueOnce({ success: true, transactionId: 'txn_fast' } as any);

    // act
    const result = await service.processPaymentWithRetry({
      paymentId,
      customerId: 'cust_x',
      paymentMethodId: 'pm_x',
      amount: 1000,
      currency: 'TWD',
    });

    // assert
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('txn_fast');
    expect(result.attempts).toBe(1);

    spy.mockRestore();
  });

  it('should retry according to engine and stop after max retries with failure', async () => {
    // arrange
    const p = buildPaymentEntity();
    p.startAttempt();
    await payments.save(p);

    // mock processing service always fail
    const processing = moduleRef.get<PaymentProcessingService>(PaymentProcessingService);
    const spy = jest.spyOn(processing, 'processPayment').mockResolvedValue({ success: false, errorMessage: 'Network timeout', failureCategory: 'RETRIABLE' as any } as any);

    // stub engine: allow retry with maxRetries=2 and small delay
    const engine = moduleRef.get<RetryStrategyEngine>(RetryStrategyEngine);
    const evalSpy = jest.spyOn(engine, 'evaluateRetryDecision').mockImplementation(async (ctx: any) => {
      const maxRetries = 2;
      const allow = ctx.attemptNumber < maxRetries; // 1 < 2 -> true, 2 < 2 -> false
      return {
        shouldRetry: allow,
        nextRetryDate: allow ? new Date(Date.now() + 10) : undefined,
        retryStrategy: 'LINEAR' as any,
        maxRetries,
        delayMinutes: 0,
        escalateToManual: false,
        notifyCustomer: false,
        reason: allow ? 'retry' : 'stop',
        appliedRules: [],
      };
    });

    // act
    const result = await service.processPaymentWithRetry({
      paymentId,
      customerId: 'cust_x',
      paymentMethodId: 'pm_x',
      amount: 1000,
      currency: 'TWD',
    });

    // assert: 應該嘗試兩次後停止（maxRetries=2）
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.finalError).toBeDefined();

    spy.mockRestore();
    evalSpy.mockRestore();
  });
});
