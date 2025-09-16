import { DomainEvent } from './domain-event';
import { SubscriptionStatus } from '../enums/codes.const';
import { Money } from '../value-objects/money';

export class SubscriptionCreated extends DomainEvent {
  readonly type = 'subscription.created';
  constructor(
    public readonly subscriptionId: string,
    public readonly customerId: string,
    public readonly productId: string,
    public readonly planId: string,
  ) {
    super();
  }
}

export class SubscriptionStatusChanged extends DomainEvent {
  readonly type = 'subscription.status.changed';
  constructor(
    public readonly subscriptionId: string,
    public readonly fromStatus: SubscriptionStatus,
    public readonly toStatus: SubscriptionStatus,
    public readonly reason?: string,
  ) {
    super();
  }
}

export class SubscriptionPlanChanged extends DomainEvent {
  readonly type = 'subscription.plan.changed';
  constructor(
    public readonly subscriptionId: string,
    public readonly oldPlanId: string,
    public readonly newPlanId: string,
    public readonly changeType?: string,
  ) {
    super();
  }
}

export class SubscriptionRefunded extends DomainEvent {
  readonly type = 'subscription.refunded';
  constructor(
    public readonly subscriptionId: string,
    public readonly refundAmount: Money,
    public readonly reason?: string,
  ) {
    super();
  }
}
