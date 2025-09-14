import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../src/domain/services/billing.service';
import { PaymentService } from '../src/domain/services/payment.service';
import { SubscriptionService } from '../src/domain/services/subscription.service';
import { SubscriptionRepository } from '../src/infra/repositories/subscription.repository';
import { PaymentRepository } from '../src/infra/repositories/payment.repository';
import { PaymentMethodRepository } from '../src/infra/repositories/payment-method.repository';
import { BusinessRulesEngineModule } from '../src/domain/services/rules-engine/business-rules-engine.module';
import { RetryStrategyEngine } from '../src/domain/services/rules-engine/retry-strategy.engine';
import { DateCalculationService } from '../src/domain/services/date-calculation/date-calculation.service';
import { PaymentProcessingService } from '../src/domain/services/payment-processing.service';
import { PaymentGatewayManager } from '../src/domain/services/payment/payment-gateway-manager.service';
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
    return 0;
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

// Gateway manager stub: always fail with a chosen failure code
class StubGatewayManager {
  // jest will mock this
  processPayment = jest.fn();
  registerGateway() {}
  setDefaultGateway() {}
}

describe('Billing → Payment failure → RetryEngine → Subscription RETRY/PAST_DUE (e2e-lite)', () => {
  let moduleRef: TestingModule;
  let billing: BillingService;
  let subs: InMemorySubscriptionRepository;
  let payments: InMemoryPaymentRepository;
  let gateway: StubGatewayManager;

  beforeAll(async () => {
    subs = new InMemorySubscriptionRepository();
    payments = new InMemoryPaymentRepository();
    gateway = new StubGatewayManager();

    moduleRef = await Test.createTestingModule({
      imports: [BusinessRulesEngineModule],
      providers: [
        BillingService,
        SubscriptionService,
        DateCalculationService,
        PaymentProcessingService,
        { provide: PaymentGatewayManager, useValue: gateway },
        { provide: SubscriptionRepository, useValue: subs },
        { provide: PaymentRepository, useValue: payments },
        { provide: PaymentMethodRepository, useClass: StubPaymentMethodRepository },
        // Use real PaymentService which now calls PaymentProcessingService
        PaymentService,
        RetryStrategyEngine,
      ],
    }).compile();

    billing = moduleRef.get(BillingService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enters RETRY with nextRetryDate for RETRIABLE failure (e.g., GATEWAY_TIMEOUT)', async () => {
    // arrange subscription
    const sub = new SubscriptionEntity('cust_a', 'pm_a', 'Basic', 1000, BillingCycle.MONTHLY);
    // activate requires metadata.paymentSuccessful when transitioning from PENDING → ACTIVE
    sub.activate({ reason: 'test', metadata: { paymentSuccessful: true } });
    await subs.save(sub);

    // process billing to create a payment
    const start = await billing.processSubscriptionBilling(sub.id!);
    // debug output on failure
    if (!start.success) {
      // eslint-disable-next-line no-console
      console.log('processSubscriptionBilling failed with:', start.error);
    }
    expect(start.success).toBe(true);
    const createdPayment = (start as any).payment;

    // gateway returns retriable failure
    (gateway.processPayment as any).mockResolvedValueOnce({
      success: false,
      paymentId: 'gw_txn_1',
      status: 'FAILED',
      amount: 1000,
      currency: 'TWD',
      errorCode: 'GATEWAY_TIMEOUT',
      errorMessage: 'Timeout',
      gatewayResponse: {},
    });

    // run PaymentService retry loop once (will decide to retry or schedule)
    const paymentService = moduleRef.get(PaymentService);
    await paymentService.processPaymentWithRetry({
      paymentId: createdPayment.id,
      customerId: sub.customerId,
      paymentMethodId: sub.paymentMethodId,
      amount: createdPayment.amount,
      currency: createdPayment.currency || 'TWD',
    });

    // billing handles failure and applies retry decision to subscription
    await billing.handlePaymentFailure(createdPayment.id);

    const updated = await subs.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.RETRY);
    expect(updated.retryState?.nextRetryDate).toBeInstanceOf(Date);
    expect(updated.retryState?.nextRetryDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('marks PAST_DUE when NON_RETRIABLE failure', async () => {
    const sub = new SubscriptionEntity('cust_b', 'pm_b', 'Basic', 1000, BillingCycle.MONTHLY);
    // activate requires metadata.paymentSuccessful when transitioning from PENDING → ACTIVE
    sub.activate({ reason: 'test', metadata: { paymentSuccessful: true } });
    await subs.save(sub);

    const start = await billing.processSubscriptionBilling(sub.id!);
    if (!start.success) {
      // eslint-disable-next-line no-console
      console.log('processSubscriptionBilling failed with:', start.error);
    }
    expect(start.success).toBe(true);
    const createdPayment = (start as any).payment;

    (gateway.processPayment as any).mockResolvedValueOnce({
      success: false,
      paymentId: 'gw_txn_2',
      status: 'FAILED',
      amount: 1000,
      currency: 'TWD',
      errorCode: 'CARD_DECLINED',
      errorMessage: 'Declined',
      gatewayResponse: {},
    });

    const paymentService = moduleRef.get(PaymentService);
    await paymentService.processPaymentWithRetry({
      paymentId: createdPayment.id,
      customerId: sub.customerId,
      paymentMethodId: sub.paymentMethodId,
      amount: createdPayment.amount,
      currency: createdPayment.currency || 'TWD',
    });

    await billing.handlePaymentFailure(createdPayment.id);

    const updated = await subs.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.PAST_DUE);
    // grace is set ~3 days; we just assert presence
    expect(updated.metadata.gracePeriodEndDate).toBeDefined();
  });
});
