import { DomainEvent } from './domain-event';
import { Money } from '../value-objects/money';
import { PaymentFailureCategory } from '../enums/codes.const';

export class PaymentSucceeded extends DomainEvent {
  readonly type = 'payment.succeeded';
  constructor(
    public readonly paymentId: string,
    public readonly subscriptionId: string,
    public readonly amount: Money,
  ) {
    super();
  }
}

export class PaymentFailed extends DomainEvent {
  readonly type = 'payment.failed';
  constructor(
    public readonly paymentId: string,
    public readonly subscriptionId: string,
    public readonly reason: string,
    public readonly category: PaymentFailureCategory,
  ) {
    super();
  }
}

export class PaymentRefunded extends DomainEvent {
  readonly type = 'payment.refunded';
  constructor(
    public readonly paymentId: string,
    public readonly subscriptionId: string,
    public readonly refundId: string,
    public readonly amount: Money,
  ) {
    super();
  }
}
