import { mapFailureCategoryFromGateway, mapFailureCategoryFromMessage, isCategoryRetriable } from '../payment-failure.util';
import { PaymentFailureCategory } from '../../enums/codes.const';

describe('payment-failure.util', () => {
  it('maps gateway status/code to failure category', () => {
    expect(mapFailureCategoryFromGateway('TIMEOUT', undefined)).toBe(PaymentFailureCategory.RETRIABLE);
    expect(mapFailureCategoryFromGateway('FAILED', 'CARD_DECLINED')).toBe(PaymentFailureCategory.NON_RETRIABLE);
    expect(mapFailureCategoryFromGateway('FAILED', 'INSUFFICIENT_FUNDS')).toBe(PaymentFailureCategory.DELAYED_RETRY);
  });

  it('maps message to failure category and checks retriable', () => {
    expect(mapFailureCategoryFromMessage('Network timeout')).toBe(PaymentFailureCategory.RETRIABLE);
    expect(isCategoryRetriable(PaymentFailureCategory.RETRIABLE)).toBe(true);
    expect(mapFailureCategoryFromMessage('card declined')).toBe(PaymentFailureCategory.NON_RETRIABLE);
    expect(isCategoryRetriable(PaymentFailureCategory.NON_RETRIABLE)).toBe(false);
  });
});
