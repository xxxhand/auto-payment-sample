import { ObjectId } from 'mongodb';
import { IBaseModel } from './base-model.interface';
import { CustomerStatus } from '../../domain/enums/codes.const';

/**
 * 客戶資料模型
 */
export interface ICustomerModel extends IBaseModel {
  /** 客戶名稱 */
  name: string;

  /** 客戶 Email */
  email: string;

  /** 客戶電話 */
  phone?: string;

  /** 客戶狀態 */
  status: CustomerStatus;

  /** 預設支付方式 ID */
  defaultPaymentMethodId: ObjectId | null;

  /** 客戶備註 */
  notes?: string;

  /** 客戶標籤 */
  tags: string[];

  /** 客戶語言偏好 */
  locale: string;

  /** 時區 */
  timezone: string;
}
