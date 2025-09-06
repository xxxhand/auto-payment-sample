import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';
import { PaymentMethodType, PaymentMethodStatus } from '../../domain/enums/codes.const';

/**
 * 支付方式資料模型
 */
export interface IPaymentMethodModel extends IBaseModel {
  /** 所屬客戶 ID */
  customerId: ObjectId;

  /** 支付方式類型 */
  type: PaymentMethodType;

  /** 支付方式名稱 */
  name: string;

  /** 支付方式狀態 */
  status: PaymentMethodStatus;

  /** 第三方支付系統的 Token 或 ID */
  externalId?: string;

  /** 遮罩後的支付資訊 */
  maskedInfo?: string;

  /** 到期日 */
  expiryDate?: Date;

  /** 是否為預設支付方式 */
  isDefault: boolean;

  /** 支付方式元資料 */
  metadata: Record<string, any>;
}
