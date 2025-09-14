import { PaymentFailureCategory } from '../enums/codes.const';

/**
 * 依 gateway 回傳的狀態與錯誤碼，推導失敗類別
 */
export function mapFailureCategoryFromGateway(status?: string, errorCode?: string): PaymentFailureCategory {
  const code = (errorCode || '').toUpperCase();
  const statusStr = (status || '').toUpperCase();

  switch (code) {
    case 'INSUFFICIENT_FUNDS':
    case 'DAILY_LIMIT_EXCEEDED':
    case 'TEMPORARILY_UNAVAILABLE':
      return PaymentFailureCategory.DELAYED_RETRY;
    case 'CARD_DECLINED':
    case 'DO_NOT_HONOR':
    case 'STOLEN_CARD':
    case 'LOST_CARD':
    case 'INVALID_CARD':
    case 'INVALID_REQUEST':
    case 'FRAUD_SUSPECTED':
      return PaymentFailureCategory.NON_RETRIABLE;
    case 'GATEWAY_TIMEOUT':
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
    case 'SERVICE_UNAVAILABLE':
      return PaymentFailureCategory.RETRIABLE;
  }

  switch (statusStr) {
    case 'FAILED':
      return PaymentFailureCategory.NON_RETRIABLE;
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return PaymentFailureCategory.RETRIABLE;
    case 'PROCESSING':
    case 'PENDING':
      return PaymentFailureCategory.RETRIABLE;
    default:
      return PaymentFailureCategory.NON_RETRIABLE;
  }
}

/**
 * 依錯誤訊息（模擬器或第三方文本）推導失敗類別
 */
export function mapFailureCategoryFromMessage(msg?: string): PaymentFailureCategory {
  const m = (msg || '').toLowerCase();
  if (!m) return PaymentFailureCategory.NON_RETRIABLE;

  if (m.includes('timeout') || m.includes('network')) return PaymentFailureCategory.RETRIABLE;
  if (m.includes('insufficient funds') || m.includes('balance')) return PaymentFailureCategory.DELAYED_RETRY;
  if (m.includes('declined') || m.includes('invalid') || m.includes('fraud')) return PaymentFailureCategory.NON_RETRIABLE;

  return PaymentFailureCategory.NON_RETRIABLE;
}

export function isCategoryRetriable(category: PaymentFailureCategory): boolean {
  return category === PaymentFailureCategory.RETRIABLE || category === PaymentFailureCategory.DELAYED_RETRY;
}
