import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionRepository } from '../../../infra/repositories/subscription.repository';
import { DateCalculationService } from '../date-calculation/date-calculation.service';
import { BillingCycle, SubscriptionStatus } from '../../entities';

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
  async findByCustomerId(customerId: string) {
    return Array.from(this.store.values()).filter((e: any) => e.customerId === customerId);
  }
  async findDueForBilling() {
    return [];
  }
  async countSubscriptions() {
    return 0;
  }
}

describe('SubscriptionService + DateCalculationService integration (phase-1)', () => {
  let module: TestingModule;
  let service: SubscriptionService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [SubscriptionService, DateCalculationService, { provide: SubscriptionRepository, useClass: InMemorySubscriptionRepository }],
    }).compile();

    service = module.get(SubscriptionService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should create subscription and set billing period using DateCalculationService (MONTHLY)', async () => {
    const sub = await service.createSubscription('cust_1', 'pm_1', 'Basic', 1000, BillingCycle.MONTHLY);

    expect(sub.currentPeriodStart).toBeInstanceOf(Date);
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
    expect(sub.nextBillingDate).toBeInstanceOf(Date);

    // monthly: end should be after start roughly ~1 month
    const msInDay = 24 * 60 * 60 * 1000;
    const days = Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / msInDay);
    expect(days).toBeGreaterThanOrEqual(28); // handle Feb
    expect(days).toBeLessThanOrEqual(31);
  });

  it('should respect trialDays by setting trial period and then billing period', async () => {
    const sub = await service.createSubscription('cust_2', 'pm_2', 'Pro', 2000, BillingCycle.MONTHLY, 7);

    expect(sub.status).toBeDefined();
    expect(sub.status).toBe(SubscriptionStatus.TRIALING);
    // trialEnd is set when trialDays provided
    expect(sub.trialEndDate).toBeInstanceOf(Date);
    // metadata 可能存放 nextBillingDate
    if (sub.metadata?.nextBillingDate) {
      expect(new Date(sub.metadata.nextBillingDate)).toBeInstanceOf(Date);
    }
    expect(sub.currentPeriodStart).toBeInstanceOf(Date);
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it('should create subscription with WEEKLY billing cycle (~7 days period) and set nextBillingDate metadata', async () => {
    const sub = await service.createSubscription('cust_w', 'pm_w', 'Weekly', 500, BillingCycle.WEEKLY);

    const msInDay = 24 * 60 * 60 * 1000;
    const days = Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / msInDay);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(8);

    expect(sub.metadata?.nextBillingDate).toBeDefined();
    expect(new Date(sub.metadata.nextBillingDate)).toBeInstanceOf(Date);
  });

  it('should create subscription with YEARLY billing cycle (~365 days period)', async () => {
    const sub = await service.createSubscription('cust_y', 'pm_y', 'Yearly', 12000, BillingCycle.YEARLY);

    const msInDay = 24 * 60 * 60 * 1000;
    const days = Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / msInDay);
    expect(days).toBeGreaterThanOrEqual(364);
    expect(days).toBeLessThanOrEqual(366);
  });

  it('should advance to next period on successful billing (MONTHLY)', async () => {
    const sub = await service.createSubscription('cust_m2', 'pm_m2', 'Basic', 1000, BillingCycle.MONTHLY);
    const end1 = sub.currentPeriodEnd;

    const updated = await service.recordSuccessfulBilling(sub.id!);
    expect(updated).not.toBeNull();
    const start2 = updated!.currentPeriodStart;
    const end2 = updated!.currentPeriodEnd;

    // 期數應往後推進，且新起始日應等於前一期的結束日（或後一天，視計算策略，此處允許相等或大於）
    expect(start2.getTime()).toBeGreaterThanOrEqual(end1.getTime());
    expect(end2.getTime()).toBeGreaterThan(start2.getTime());
    // metadata 應包含 nextBillingDate
    if (updated!.metadata?.nextBillingDate) {
      expect(new Date(updated!.metadata.nextBillingDate)).toBeInstanceOf(Date);
    }
  });

  it('should advance to next period on successful billing (WEEKLY)', async () => {
    const sub = await service.createSubscription('cust_w2', 'pm_w2', 'Weekly', 500, BillingCycle.WEEKLY);
    const end1 = sub.currentPeriodEnd;

    const updated = await service.recordSuccessfulBilling(sub.id!);
    expect(updated).not.toBeNull();
    const start2 = updated!.currentPeriodStart;
    const end2 = updated!.currentPeriodEnd;

    // 新週期應約 7 天
    const msInDay = 24 * 60 * 60 * 1000;
    const days = Math.round((end2.getTime() - start2.getTime()) / msInDay);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(8);

    // 新起始日應落在或晚於前期結束
    expect(start2.getTime()).toBeGreaterThanOrEqual(end1.getTime());
  });
});
