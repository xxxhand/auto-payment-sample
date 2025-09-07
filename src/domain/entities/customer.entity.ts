import { BaseEntity } from './base-entity.abstract';
import { CustomerStatus } from '../enums/codes.const';

/**
 * 客戶實體
 * 代表系統中的付款客戶
 */
export class CustomerEntity extends BaseEntity {
  /** 客戶名稱 */
  public name: string = '';

  /** 客戶 Email */
  public email: string = '';

  /** 客戶電話 */
  public phone: string = '';

  /** 客戶狀態 */
  public status: CustomerStatus = CustomerStatus.ACTIVE;

  /** 預設支付方式 ID */
  public defaultPaymentMethodId?: string;

  /** 客戶備註 */
  public notes?: string;

  /** 客戶標籤 */
  public tags: string[] = [];

  /** 客戶語言偏好 */
  public locale: string = 'zh-TW';

  /** 時區 */
  public timezone: string = 'Asia/Taipei';

  /** 客戶元數據（用於合規性和擴展資訊） */
  public metadata: Record<string, any> = {};

  constructor(name: string, email: string) {
    super();
    this.name = name;
    this.email = email;
  }

  /**
   * 檢查客戶是否為活躍狀態
   */
  public isActive(): boolean {
    return this.status === CustomerStatus.ACTIVE;
  }

  /**
   * 停用客戶
   */
  public deactivate(): void {
    this.status = CustomerStatus.INACTIVE;
    this.touch();
  }

  /**
   * 啟用客戶
   */
  public activate(): void {
    this.status = CustomerStatus.ACTIVE;
    this.touch();
  }

  /**
   * 更新客戶資訊
   */
  public updateInfo(updates: Partial<Pick<CustomerEntity, 'name' | 'email' | 'phone' | 'notes'>>): void {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.email !== undefined) this.email = updates.email;
    if (updates.phone !== undefined) this.phone = updates.phone;
    if (updates.notes !== undefined) this.notes = updates.notes;
    this.touch();
  }

  /**
   * 設定預設支付方式
   */
  public setDefaultPaymentMethod(paymentMethodId: string): void {
    this.defaultPaymentMethodId = paymentMethodId;
    this.touch();
  }

  /**
   * 新增標籤
   */
  public addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.touch();
    }
  }

  /**
   * 移除標籤
   */
  public removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.touch();
    }
  }
}
