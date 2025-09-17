// Promotion domain enums
export enum PromotionType {
  CODE = 'CODE',
  CAMPAIGN = 'CAMPAIGN',
  INTRO = 'INTRO',
  TIERED = 'TIERED',
  THRESHOLD = 'THRESHOLD',
}

export enum DiscountType {
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  PERCENTAGE = 'PERCENTAGE',
  FREE_CYCLES = 'FREE_CYCLES',
  TIERED = 'TIERED',
  THRESHOLD_BONUS = 'THRESHOLD_BONUS',
}

export enum PromotionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}

export enum PromotionAuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  STATUS_CHANGE = 'STATUS_CHANGE',
  FORCE_EXPIRE = 'FORCE_EXPIRE',
  USAGE_ADJUST = 'USAGE_ADJUST',
}
