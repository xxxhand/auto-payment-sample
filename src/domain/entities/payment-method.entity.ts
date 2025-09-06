import { BaseEntity } from './base-entity.abstract';
import { PaymentMethodType, PaymentMethodStatus } from '../enums/codes.const';

/**
 * 支付方式實體
 * 代表客戶的支付方式（信用卡、銀行轉帳等）
 */
export class PaymentMethodEntity extends BaseEntity {
  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 支付方式類型 */
  public type: PaymentMethodType = PaymentMethodType.CREDIT_CARD;

  /** 支付方式名稱 */
  public name: string = '';

  /** 支付方式狀態 */
  public status: PaymentMethodStatus = PaymentMethodStatus.ACTIVE;

  /** 第三方支付系統的 Token 或 ID */
  public externalId?: string;

  /** 遮罩後的支付資訊（例如：**** **** **** 1234） */
  public maskedInfo?: string;

  /** 到期日（適用於信用卡） */
  public expiryDate?: Date;

  /** 是否為預設支付方式 */
  public isDefault: boolean = false;

  /** 支付方式元資料 */
  public metadata: Record<string, any> = {};

  constructor(customerId: string, type: PaymentMethodType, name: string) {
    super();
    this.customerId = customerId;
    this.type = type;
    this.name = name;
  }

  /**
   * 檢查支付方式是否可用
   */
  public isAvailable(): boolean {
    return this.status === PaymentMethodStatus.ACTIVE && !this.isExpired();
  }

  /**
   * 檢查是否已過期
   */
  public isExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
  }

  /**
   * 停用支付方式
   */
  public deactivate(): void {
    this.status = PaymentMethodStatus.INACTIVE;
    this.touch();
  }

  /**
   * 啟用支付方式
   */
  public activate(): void {
    this.status = PaymentMethodStatus.ACTIVE;
    this.touch();
  }

  /**
   * 設為預設支付方式
   */
  public setAsDefault(): void {
    this.isDefault = true;
    this.touch();
  }

  /**
   * 取消預設設定
   */
  public unsetDefault(): void {
    this.isDefault = false;
    this.touch();
  }

  /**
   * 更新遮罩資訊
   */
  public updateMaskedInfo(maskedInfo: string): void {
    this.maskedInfo = maskedInfo;
    this.touch();
  }

  /**
   * 更新到期日
   */
  public updateExpiryDate(expiryDate: Date): void {
    this.expiryDate = expiryDate;
    this.touch();
  }

  /**
   * 設定外部 ID
   */
  public setExternalId(externalId: string): void {
    this.externalId = externalId;
    this.touch();
  }

  /**
   * 更新元資料
   */
  public updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }
}
