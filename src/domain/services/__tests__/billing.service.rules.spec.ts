import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { SubscriptionRepository } from '../../../infra/repositories/subscription.repository';
import { PaymentService } from '../payment.service';
import { PaymentMethodRepository } from '../../../infra/repositories/payment-method.repository';
import { BusinessRulesEngineModule } from '../rules-engine/business-rules-engine.module';
import { SubscriptionEntity, PaymentMethodEntity } from '../../entities';
import { BillingCycle, SubscriptionStatus, PaymentFailureCategory, PaymentMethodType, PaymentMethodStatus } from '../../entities';
import { SubscriptionService } from '../subscription.service';

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
}

class StubPaymentService {
  public created: any[] = [];
  constructor(private readonly subRepo: InMemorySubscriptionRepository) {}

  async createPayment(subscriptionId: string, customerId: string, paymentMethodId: string, amount: number, currency: string, description?: string) {
    const sub = await this.subRepo.findById(subscriptionId);
    const payment = {
      id: `pay_${Date.now()}`,
      subscriptionId,
      customerId,
      paymentMethodId,
      amount,
      currency,
      description,
      billingPeriodStart: sub.currentPeriodStart,
      billingPeriodEnd: sub.currentPeriodEnd,
      status: 'PENDING',
    };
    this.created.push(payment);
    return payment as any;
  }

  async startPaymentAttempt(_paymentId: string) {
    // mark as used to satisfy linter
    void _paymentId;
    // no-op for unit test
    return null as any;
  }

  async getPaymentById(_id: string) {
    // parse subscription id from paymentId format: pay_for_<subId>
    const match = /^pay_for_(.+)$/.exec(_id);
    const subscriptionId = match ? match[1] : 'sub_1';
    return {
      id: _id,
      subscriptionId,
      amount: 1000,
      currency: 'TWD',
      failureDetails: {
        category: PaymentFailureCategory.RETRIABLE,
        isRetriable: true,
        failedAt: new Date(),
      },
      retryState: { attemptNumber: 1 },
    } as any;
  }

  async getPaymentsBySubscriptionId(_subscriptionId: string) {
    void _subscriptionId;
    // return two failed historical payments
    return [{ isFailed: () => true } as any, { isFailed: () => true } as any];
  }
}

class StubPaymentMethodRepository {
  public method?: PaymentMethodEntity;
  async findById(_id: string) {
    void _id;
    return this.method || null;
  }
}

describe('BillingService + RulesEngine integration (phase-2 wiring)', () => {
  let moduleRef: TestingModule;
  let billingService: BillingService;
  let subRepo: InMemorySubscriptionRepository;
  let pmRepo: StubPaymentMethodRepository;

  beforeAll(async () => {
    subRepo = new InMemorySubscriptionRepository();
    pmRepo = new StubPaymentMethodRepository();

    moduleRef = await Test.createTestingModule({
      imports: [BusinessRulesEngineModule],
      providers: [
        BillingService,
        { provide: SubscriptionRepository, useValue: subRepo },
        { provide: PaymentService, useFactory: () => new StubPaymentService(subRepo) },
        { provide: PaymentMethodRepository, useValue: pmRepo },
        { provide: SubscriptionService, useValue: { recordSuccessfulBilling: jest.fn() } },
      ],
    }).compile();

    billingService = moduleRef.get(BillingService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should block pre-billing when payment method is invalid', async () => {
    // arrange: active subscription
    const sub = new SubscriptionEntity('cust_x', 'pm_x', 'Basic', 1000, BillingCycle.MONTHLY);
    sub.activate({ metadata: { paymentSuccessful: true } });
    await subRepo.save(sub);

    // invalid payment method (inactive)
    const pm = new PaymentMethodEntity(sub.customerId, PaymentMethodType.CREDIT_CARD, 'VISA');
    pm.status = PaymentMethodStatus.INACTIVE; // INACTIVE
    (pm as any).isAvailable = () => false; // ensure engine sees invalid
    pmRepo.method = pm;

    const result = await billingService.processSubscriptionBilling(sub.id!);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Billing blocked/i);
  });

  it('should enter retry state and set nextRetryDate on payment failure', async () => {
    // arrange: active subscription
    const sub = new SubscriptionEntity('cust_y', 'pm_y', 'Pro', 1500, BillingCycle.MONTHLY);
    sub.activate({ metadata: { paymentSuccessful: true } });
    await subRepo.save(sub);

    // act
    await billingService.handlePaymentFailure(`pay_for_${sub.id}`);

    // assert: subscription moved to RETRY with nextRetryDate
    const updated = await subRepo.findById(sub.id!);
    expect(updated.status).toBe(SubscriptionStatus.RETRY);
    expect(updated.retryState?.nextRetryDate).toBeInstanceOf(Date);
    expect(updated.retryState?.nextRetryDate!.getTime()).toBeGreaterThan(Date.now());
  });
});
