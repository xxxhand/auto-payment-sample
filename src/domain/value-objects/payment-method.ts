import { PaymentMethodType } from '../enums/codes.const';

/**
 * 支付方式驗證結果
 */
export interface PaymentMethodValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number; // 0-100
  expiryStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

/**
 * 卡片資訊
 */
export interface CardInfo {
  /** 卡片後四碼 */
  lastFourDigits: string;
  /** 卡片品牌 */
  brand: 'VISA' | 'MASTERCARD' | 'JCB' | 'AMEX' | 'UNION_PAY' | 'OTHER';
  /** 過期年月 */
  expiryMonth: number;
  expiryYear: number;
  /** 持卡人姓名 */
  holderName?: string;
  /** 發卡國家 */
  issuerCountry?: string;
  /** 卡片類型 */
  cardType: 'CREDIT' | 'DEBIT' | 'PREPAID' | 'UNKNOWN';
  /** 是否支援3D驗證 */
  supports3DS: boolean;
}

/**
 * 銀行帳戶資訊
 */
export interface BankAccountInfo {
  /** 銀行代碼 */
  bankCode: string;
  /** 帳戶後四碼 */
  lastFourDigits: string;
  /** 帳戶類型 */
  accountType: 'CHECKING' | 'SAVINGS' | 'BUSINESS';
  /** 銀行名稱 */
  bankName?: string;
  /** 分行代碼 */
  branchCode?: string;
}

/**
 * 電子錢包資訊
 */
export interface EWalletInfo {
  /** 錢包提供商 */
  provider: 'LINE_PAY' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'SAMSUNG_PAY' | 'ALIPAY' | 'WECHAT_PAY' | 'OTHER';
  /** 帳戶識別 */
  accountId?: string;
  /** 是否已驗證 */
  isVerified: boolean;
  /** 支援的功能 */
  features: string[];
}

/**
 * 支付方式值物件
 * 封裝支付方式的驗證、處理和安全檢查邏輯
 */
export class PaymentMethodVO {
  private readonly _type: PaymentMethodType;
  private readonly _token: string;
  private readonly _isDefault: boolean;
  private readonly _cardInfo?: CardInfo;
  private readonly _bankAccountInfo?: BankAccountInfo;
  private readonly _eWalletInfo?: EWalletInfo;
  private readonly _metadata: Record<string, any>;
  private readonly _createdAt: Date;
  private readonly _lastUsedAt?: Date;
  private readonly _failureCount: number;
  private readonly _isActive: boolean;

  constructor(data: {
    type: PaymentMethodType;
    token: string;
    isDefault?: boolean;
    cardInfo?: CardInfo;
    bankAccountInfo?: BankAccountInfo;
    eWalletInfo?: EWalletInfo;
    metadata?: Record<string, any>;
    createdAt?: Date;
    lastUsedAt?: Date;
    failureCount?: number;
    isActive?: boolean;
  }) {
    this.validateConstructorData(data);

    this._type = data.type;
    this._token = data.token;
    this._isDefault = data.isDefault ?? false;
    this._cardInfo = data.cardInfo;
    this._bankAccountInfo = data.bankAccountInfo;
    this._eWalletInfo = data.eWalletInfo;
    this._metadata = data.metadata ?? {};
    this._createdAt = data.createdAt ?? new Date();
    this._lastUsedAt = data.lastUsedAt;
    this._failureCount = data.failureCount ?? 0;
    this._isActive = data.isActive ?? true;
  }

  get type(): PaymentMethodType {
    return this._type;
  }

  get token(): string {
    return this._token;
  }

  get isDefault(): boolean {
    return this._isDefault;
  }

  get cardInfo(): CardInfo | undefined {
    return this._cardInfo;
  }

  get bankAccountInfo(): BankAccountInfo | undefined {
    return this._bankAccountInfo;
  }

  get eWalletInfo(): EWalletInfo | undefined {
    return this._eWalletInfo;
  }

  get metadata(): Record<string, any> {
    return { ...this._metadata };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get lastUsedAt(): Date | undefined {
    return this._lastUsedAt;
  }

  get failureCount(): number {
    return this._failureCount;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * 驗證支付方式
   */
  validate(): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityScore = 100;
    let expiryStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';

    // 基本驗證
    if (!this._token || this._token.length < 10) {
      errors.push('Invalid payment method token');
      securityScore -= 30;
    }

    if (!this._isActive) {
      errors.push('Payment method is inactive');
    }

    // 根據類型進行特定驗證
    switch (this._type) {
      case PaymentMethodType.CREDIT_CARD:
      case PaymentMethodType.DEBIT_CARD:
        const cardValidation = this.validateCard();
        errors.push(...cardValidation.errors);
        warnings.push(...cardValidation.warnings);
        securityScore = Math.min(securityScore, cardValidation.securityScore);
        expiryStatus = cardValidation.expiryStatus;
        break;

      case PaymentMethodType.BANK_TRANSFER:
        const bankValidation = this.validateBankAccount();
        errors.push(...bankValidation.errors);
        warnings.push(...bankValidation.warnings);
        securityScore = Math.min(securityScore, bankValidation.securityScore);
        break;

      case PaymentMethodType.E_WALLET:
        const walletValidation = this.validateEWallet();
        errors.push(...walletValidation.errors);
        warnings.push(...walletValidation.warnings);
        securityScore = Math.min(securityScore, walletValidation.securityScore);
        break;
    }

    // 失敗次數檢查
    if (this._failureCount > 3) {
      warnings.push('Payment method has multiple recent failures');
      securityScore -= 20;
    }

    if (this._failureCount > 10) {
      errors.push('Payment method has too many failures');
      securityScore -= 30;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityScore: Math.max(0, securityScore),
      expiryStatus,
    };
  }

  /**
   * 檢查是否即將過期
   */
  isExpiringWithin(days: number): boolean {
    if (this._type !== PaymentMethodType.CREDIT_CARD && this._type !== PaymentMethodType.DEBIT_CARD) {
      return false;
    }

    if (!this._cardInfo) {
      return false;
    }

    const expiryDate = new Date(this._cardInfo.expiryYear, this._cardInfo.expiryMonth - 1);
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + days);

    return expiryDate <= checkDate;
  }

  /**
   * 檢查是否已過期
   */
  isExpired(): boolean {
    if (this._type !== PaymentMethodType.CREDIT_CARD && this._type !== PaymentMethodType.DEBIT_CARD) {
      return false;
    }

    if (!this._cardInfo) {
      return false;
    }

    const expiryDate = new Date(this._cardInfo.expiryYear, this._cardInfo.expiryMonth - 1);
    const now = new Date();

    return expiryDate < now;
  }

  /**
   * 獲取顯示名稱
   */
  getDisplayName(): string {
    switch (this._type) {
      case PaymentMethodType.CREDIT_CARD:
        return this._cardInfo ? `${this._cardInfo.brand} •••• ${this._cardInfo.lastFourDigits}` : 'Credit Card';

      case PaymentMethodType.DEBIT_CARD:
        return this._cardInfo ? `${this._cardInfo.brand} Debit •••• ${this._cardInfo.lastFourDigits}` : 'Debit Card';

      case PaymentMethodType.BANK_TRANSFER:
        return this._bankAccountInfo ? `${this._bankAccountInfo.bankName} •••• ${this._bankAccountInfo.lastFourDigits}` : 'Bank Transfer';

      case PaymentMethodType.E_WALLET:
        return this._eWalletInfo ? this._eWalletInfo.provider.replace('_', ' ') : 'E-Wallet';

      default:
        return 'Payment Method';
    }
  }

  /**
   * 獲取遮罩後的資訊
   */
  getMaskedInfo(): Record<string, any> {
    const base = {
      type: this._type,
      displayName: this.getDisplayName(),
      isDefault: this._isDefault,
      isActive: this._isActive,
      failureCount: this._failureCount,
      lastUsedAt: this._lastUsedAt,
    };

    switch (this._type) {
      case PaymentMethodType.CREDIT_CARD:
      case PaymentMethodType.DEBIT_CARD:
        return {
          ...base,
          brand: this._cardInfo?.brand,
          lastFourDigits: this._cardInfo?.lastFourDigits,
          expiryMonth: this._cardInfo?.expiryMonth,
          expiryYear: this._cardInfo?.expiryYear,
          cardType: this._cardInfo?.cardType,
          supports3DS: this._cardInfo?.supports3DS,
        };

      case PaymentMethodType.BANK_TRANSFER:
        return {
          ...base,
          bankName: this._bankAccountInfo?.bankName,
          lastFourDigits: this._bankAccountInfo?.lastFourDigits,
          accountType: this._bankAccountInfo?.accountType,
        };

      case PaymentMethodType.E_WALLET:
        return {
          ...base,
          provider: this._eWalletInfo?.provider,
          isVerified: this._eWalletInfo?.isVerified,
          features: this._eWalletInfo?.features,
        };

      default:
        return base;
    }
  }

  /**
   * 檢查是否支援特定功能
   */
  supports(feature: string): boolean {
    switch (feature) {
      case 'recurring_payments':
        return (
          this._type === PaymentMethodType.CREDIT_CARD ||
          this._type === PaymentMethodType.DEBIT_CARD ||
          (this._type === PaymentMethodType.E_WALLET && this._eWalletInfo?.features.includes('recurring'))
        );

      case '3d_secure':
        return this._type === PaymentMethodType.CREDIT_CARD && this._cardInfo?.supports3DS === true;

      case 'instant_payment':
        return this._type === PaymentMethodType.E_WALLET || this._type === PaymentMethodType.CREDIT_CARD;

      case 'refunds':
        return this._type !== PaymentMethodType.BANK_TRANSFER; // 銀行轉帳通常不支援自動退款

      default:
        return false;
    }
  }

  /**
   * 計算風險分數
   */
  calculateRiskScore(): number {
    let riskScore = 0;

    // 失敗次數風險
    riskScore += Math.min(this._failureCount * 10, 50);

    // 新支付方式風險
    const daysSinceCreated = (Date.now() - this._createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 1) {
      riskScore += 20;
    } else if (daysSinceCreated < 7) {
      riskScore += 10;
    }

    // 長期未使用風險
    if (this._lastUsedAt) {
      const daysSinceLastUsed = (Date.now() - this._lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUsed > 180) {
        riskScore += 15;
      } else if (daysSinceLastUsed > 90) {
        riskScore += 10;
      }
    } else {
      riskScore += 10; // 從未使用過
    }

    // 卡片過期風險
    if (this.isExpired()) {
      riskScore += 100; // 已過期，最高風險
    } else if (this.isExpiringWithin(30)) {
      riskScore += 25;
    }

    // 非活躍狀態風險
    if (!this._isActive) {
      riskScore += 50;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * 創建新的支付方式實例（用於更新）
   */
  withUpdates(
    updates: Partial<{
      isDefault: boolean;
      isActive: boolean;
      lastUsedAt: Date;
      failureCount: number;
      metadata: Record<string, any>;
    }>,
  ): PaymentMethodVO {
    return new PaymentMethodVO({
      type: this._type,
      token: this._token,
      isDefault: updates.isDefault ?? this._isDefault,
      cardInfo: this._cardInfo,
      bankAccountInfo: this._bankAccountInfo,
      eWalletInfo: this._eWalletInfo,
      metadata: updates.metadata ?? this._metadata,
      createdAt: this._createdAt,
      lastUsedAt: updates.lastUsedAt ?? this._lastUsedAt,
      failureCount: updates.failureCount ?? this._failureCount,
      isActive: updates.isActive ?? this._isActive,
    });
  }

  /**
   * 檢查是否相等
   */
  equals(other: PaymentMethodVO): boolean {
    return this._token === other._token && this._type === other._type;
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      type: this._type,
      token: this._token,
      displayName: this.getDisplayName(),
      maskedInfo: this.getMaskedInfo(),
      validation: this.validate(),
      riskScore: this.calculateRiskScore(),
      supports: {
        recurringPayments: this.supports('recurring_payments'),
        threeDSecure: this.supports('3d_secure'),
        instantPayment: this.supports('instant_payment'),
        refunds: this.supports('refunds'),
      },
      isDefault: this._isDefault,
      isActive: this._isActive,
      createdAt: this._createdAt,
      lastUsedAt: this._lastUsedAt,
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): PaymentMethodVO {
    return new PaymentMethodVO({
      type: data.type,
      token: data.token,
      isDefault: data.isDefault,
      cardInfo: data.cardInfo,
      bankAccountInfo: data.bankAccountInfo,
      eWalletInfo: data.eWalletInfo,
      metadata: data.metadata,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : undefined,
      failureCount: data.failureCount,
      isActive: data.isActive,
    });
  }

  /**
   * 創建信用卡支付方式
   */
  static createCreditCard(token: string, cardInfo: CardInfo, options: { isDefault?: boolean; metadata?: Record<string, any> } = {}): PaymentMethodVO {
    return new PaymentMethodVO({
      type: PaymentMethodType.CREDIT_CARD,
      token,
      cardInfo,
      isDefault: options.isDefault,
      metadata: options.metadata,
    });
  }

  /**
   * 創建電子錢包支付方式
   */
  static createEWallet(token: string, eWalletInfo: EWalletInfo, options: { isDefault?: boolean; metadata?: Record<string, any> } = {}): PaymentMethodVO {
    return new PaymentMethodVO({
      type: PaymentMethodType.E_WALLET,
      token,
      eWalletInfo,
      isDefault: options.isDefault,
      metadata: options.metadata,
    });
  }

  /**
   * 驗證建構資料
   */
  private validateConstructorData(data: any): void {
    if (!data.type) {
      throw new Error('Payment method type is required');
    }

    if (!data.token || typeof data.token !== 'string') {
      throw new Error('Payment method token is required');
    }

    // 根據類型驗證必要資訊
    switch (data.type) {
      case PaymentMethodType.CREDIT_CARD:
      case PaymentMethodType.DEBIT_CARD:
        if (!data.cardInfo) {
          throw new Error('Card info is required for card payment methods');
        }
        break;

      case PaymentMethodType.BANK_TRANSFER:
        if (!data.bankAccountInfo) {
          throw new Error('Bank account info is required for bank transfer');
        }
        break;

      case PaymentMethodType.E_WALLET:
        if (!data.eWalletInfo) {
          throw new Error('E-wallet info is required for e-wallet payment methods');
        }
        break;
    }
  }

  /**
   * 驗證信用卡/金融卡
   */
  private validateCard(): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityScore = 100;
    let expiryStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';

    if (!this._cardInfo) {
      errors.push('Card information is missing');
      return { isValid: false, errors, warnings, securityScore: 0, expiryStatus: 'EXPIRED' };
    }

    // 檢查過期狀態
    if (this.isExpired()) {
      errors.push('Card has expired');
      expiryStatus = 'EXPIRED';
      securityScore = 0;
    } else if (this.isExpiringWithin(30)) {
      warnings.push('Card will expire within 30 days');
      expiryStatus = 'EXPIRING_SOON';
      securityScore -= 10;
    }

    // 檢查卡號格式
    if (!this._cardInfo.lastFourDigits || !/^\d{4}$/.test(this._cardInfo.lastFourDigits)) {
      errors.push('Invalid card number format');
      securityScore -= 20;
    }

    // 檢查有效期格式
    if (this._cardInfo.expiryMonth < 1 || this._cardInfo.expiryMonth > 12) {
      errors.push('Invalid expiry month');
      securityScore -= 15;
    }

    if (this._cardInfo.expiryYear < new Date().getFullYear()) {
      errors.push('Invalid expiry year');
      securityScore -= 15;
    }

    // 3D Secure 檢查
    if (!this._cardInfo.supports3DS && this._type === PaymentMethodType.CREDIT_CARD) {
      warnings.push('Card does not support 3D Secure');
      securityScore -= 5;
    }

    return { isValid: errors.length === 0, errors, warnings, securityScore, expiryStatus };
  }

  /**
   * 驗證銀行帳戶
   */
  private validateBankAccount(): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityScore = 90; // 銀行轉帳相對安全

    if (!this._bankAccountInfo) {
      errors.push('Bank account information is missing');
      return { isValid: false, errors, warnings, securityScore: 0, expiryStatus: 'VALID' };
    }

    if (!this._bankAccountInfo.bankCode) {
      errors.push('Bank code is required');
      securityScore -= 20;
    }

    if (!this._bankAccountInfo.lastFourDigits || !/^\d{4}$/.test(this._bankAccountInfo.lastFourDigits)) {
      errors.push('Invalid account number format');
      securityScore -= 15;
    }

    return { isValid: errors.length === 0, errors, warnings, securityScore, expiryStatus: 'VALID' };
  }

  /**
   * 驗證電子錢包
   */
  private validateEWallet(): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityScore = 95; // 電子錢包通常很安全

    if (!this._eWalletInfo) {
      errors.push('E-wallet information is missing');
      return { isValid: false, errors, warnings, securityScore: 0, expiryStatus: 'VALID' };
    }

    if (!this._eWalletInfo.isVerified) {
      warnings.push('E-wallet account is not verified');
      securityScore -= 15;
    }

    if (!this._eWalletInfo.features || this._eWalletInfo.features.length === 0) {
      warnings.push('Limited e-wallet features available');
      securityScore -= 5;
    }

    return { isValid: errors.length === 0, errors, warnings, securityScore, expiryStatus: 'VALID' };
  }
}
