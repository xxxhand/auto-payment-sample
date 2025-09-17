import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';
import { ICustomerModel } from './customer.model';
import { IPaymentMethodModel } from './payment-method.model';
import { ISubscriptionModel } from './subscription.model';
import { IPaymentModel } from './payment.model';
import { IBillingAttemptModel } from './billing-attempt.model';
import { IPromotionModel } from './promotion.model';
import { IPromotionUsageModel } from './promotion-usage.model';
import { IPromotionApplicationModel } from './promotion-application.model';

export enum modelNames {
  // 核心領域集合
  CUSTOMERS = 'Customers',
  PAYMENT_METHODS = 'PaymentMethods',
  SUBSCRIPTIONS = 'Subscriptions',
  PAYMENTS = 'Payments',
  BILLING_ATTEMPTS = 'BillingAttempts',
  PROMOTIONS = 'Promotions',
  PROMOTION_USAGES = 'PromotionUsages',
  PROMOTION_APPLICATIONS = 'PromotionApplications',

  // 範例集合 (後續版本將移除)
  EXAMPLE = 'Examples',
}

// 核心領域文檔型別
export type ICustomerDocument = WithId<ICustomerModel>;
export type IPaymentMethodDocument = WithId<IPaymentMethodModel>;
export type ISubscriptionDocument = WithId<ISubscriptionModel>;
export type IPaymentDocument = WithId<IPaymentModel>;
export type IBillingAttemptDocument = WithId<IBillingAttemptModel>;
export type IPromotionDocument = WithId<IPromotionModel>;
export type IPromotionUsageDocument = WithId<IPromotionUsageModel>;
export type IPromotionApplicationDocument = WithId<IPromotionApplicationModel>;

// 範例文檔型別 (後續版本將移除)
export type IExampleDocument = WithId<IExampleModel>;
