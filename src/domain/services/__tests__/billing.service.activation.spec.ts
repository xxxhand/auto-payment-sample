import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { SubscriptionRepository } from '../../../infra/repositories/subscription.repository';
import { PaymentService } from '../payment.service';
import { PaymentMethodRepository } from '../../../infra/repositories/payment-method.repository';
import { BusinessRulesEngineModule } from '../rules-engine/business-rules-engine.module';
import { SubscriptionEntity } from '../../entities/subscription.entity';
import { BillingCycle, SubscriptionStatus } from '../../enums/codes.const';
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
}

describe('BillingService.handlePaymentSuccess activation paths', () => {
  let moduleRef: TestingModule;
  let billing: BillingService;
  let subs: InMemorySubscriptionRepository;

  const paymentStub: Partial<PaymentService> = {
    getPaymentById: async (id: string) => ({ id, subscriptionId: 'sub_1' }) as any,
  };

  beforeAll(async () => {
    subs = new InMemorySubscriptionRepository();
    moduleRef = await Test.createTestingModule({
      imports: [BusinessRulesEngineModule],
      providers: [
        BillingService,
        { provide: SubscriptionRepository, useValue: subs },
        { provide: PaymentService, useValue: paymentStub },
        { provide: PaymentMethodRepository, useValue: {} },
        { provide: SubscriptionService, useValue: { recordSuccessfulBilling: jest.fn(async (sid: string) => sid) } },
      ],
    }).compile();

    billing = moduleRef.get(BillingService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('transitions PENDING → ACTIVE on first successful payment', async () => {
    const s = new SubscriptionEntity('cus_a', 'pm_a', 'Basic', 1000, BillingCycle.MONTHLY);
    // keep as PENDING (no metadata to activate yet)
    await subs.save(s);
    // wire payment to this subscription
    (paymentStub.getPaymentById as any) = async () => ({ id: 'pay_1', subscriptionId: s.id });

    await billing.handlePaymentSuccess('pay_1');

    const updated = await subs.findById(s.id!);
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('transitions GRACE_PERIOD → ACTIVE on payment resolution and resets retry state', async () => {
    const s = new SubscriptionEntity('cus_b', 'pm_b', 'Pro', 1500, BillingCycle.MONTHLY);
    s.activate({ metadata: { paymentSuccessful: true } });
    s.enterGracePeriod(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    await subs.save(s);
    (paymentStub.getPaymentById as any) = async () => ({ id: 'pay_2', subscriptionId: s.id });

    await billing.handlePaymentSuccess('pay_2');

    const updated = await subs.findById(s.id!);
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated.retryState?.retryCount).toBe(0);
    expect(updated.retryState?.nextRetryDate).toBeUndefined();
  });
});
