/**
 * 綠界 ECPay 支付閘道特殊介面
 * 擴展標準支付介面以支援綠界特有功能
 */
import { IPaymentGateway, PaymentCreateOptions, PaymentResult } from './payment-gateway.interface';

/**
 * 綠界支付閘道擴展介面
 */
export interface IECPayGateway extends IPaymentGateway {
  /**
   * 創建信用卡定期定額支付
   */
  createPeriodPayment(options: PeriodPaymentOptions): Promise<PeriodPaymentResult>;

  /**
   * 創建 ATM 虛擬帳號支付
   */
  createATMPayment(options: ATMPaymentOptions): Promise<ATMPaymentResult>;

  /**
   * 創建便利商店代碼繳費
   */
  createCVSPayment(options: CVSPaymentOptions): Promise<CVSPaymentResult>;

  /**
   * 查詢交易資訊
   */
  queryTradeInfo(merchantTradeNo: string): Promise<ECPayTradeInfo>;

  /**
   * 產生檢查碼 (CheckMacValue)
   */
  generateCheckMacValue(parameters: Record<string, any>): string;
}

/**
 * 綠界支付方式
 */
export enum ECPayPaymentMethod {
  CREDIT = 'Credit', // 信用卡
  WEBATM = 'WebATM', // 網路 ATM
  ATM = 'ATM', // 自動櫃員機
  CVS = 'CVS', // 超商代碼
  BARCODE = 'BARCODE', // 超商條碼
  ALIPAY = 'Alipay', // 支付寶
  TENPAY = 'Tenpay', // 財付通
  TOPUPUSED = 'TopUpUsed', // 儲值消費
}

/**
 * 綠界定期定額頻率
 */
export enum PeriodType {
  DAY = 'D', // 以天為週期
  MONTH = 'M', // 以月為週期
  YEAR = 'Y', // 以年為週期
}

/**
 * 定期定額支付選項
 */
export interface PeriodPaymentOptions extends PaymentCreateOptions {
  periodType: PeriodType;
  frequency: number; // 執行頻率
  execTimes: number; // 執行次數，0 表示無限期
  periodAmount: number; // 每期金額
  periodReturnURL: string; // 定期定額回傳網址
}

/**
 * 定期定額支付結果
 */
export interface PeriodPaymentResult extends PaymentResult {
  periodType: PeriodType;
  frequency: number;
  execTimes: number;
  periodAmount: number;
  nextExecDate?: string; // 下次執行日期
  totalSuccessAmount?: number; // 已成功授權總金額
  totalSuccessTimes?: number; // 已成功授權次數
}

/**
 * ATM 支付選項
 */
export interface ATMPaymentOptions extends PaymentCreateOptions {
  expireDate: string; // 繳費期限 (格式: yyyy/MM/dd)
  paymentInfoURL?: string; // 伺服器端回傳付款相關資訊
}

/**
 * ATM 支付結果
 */
export interface ATMPaymentResult extends PaymentResult {
  bankCode: string; // 銀行代碼
  vAccount: string; // 虛擬帳號
  expireDate: string; // 繳費期限
}

/**
 * 便利商店支付選項
 */
export interface CVSPaymentOptions extends PaymentCreateOptions {
  storeType: 'CVS' | 'BARCODE'; // CVS: 代碼繳費, BARCODE: 條碼繳費
  desc1?: string; // 繳費說明 1
  desc2?: string; // 繳費說明 2
  desc3?: string; // 繳費說明 3
  desc4?: string; // 繳費說明 4
  paymentInfoURL?: string; // 伺服器端回傳付款相關資訊
}

/**
 * 便利商店支付結果
 */
export interface CVSPaymentResult extends PaymentResult {
  paymentNo: string; // 繳費代碼或條碼
  expireDate: string; // 繳費期限
  storeType: 'CVS' | 'BARCODE';
  desc1?: string;
  desc2?: string;
  desc3?: string;
  desc4?: string;
}

/**
 * 綠界交易資訊查詢結果
 */
export interface ECPayTradeInfo {
  merchantID: string;
  merchantTradeNo: string;
  tradeNo: string;
  tradeDate: string;
  paymentDate?: string;
  paymentType: string;
  paymentTypeChargeFee: string;
  tradeAmt: number;
  paidAmt?: number;
  tradeStatus: ECPayTradeStatus;
  itemName: string;
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
}

/**
 * 綠界交易狀態
 */
export enum ECPayTradeStatus {
  UNPAID = '0', // 未付款
  PAID = '1', // 已付款
  FAILED = '2', // 付款失敗
  REFUND = '10001', // 已退款
  PARTIAL_REFUND = '10002', // 部分退款
}

/**
 * 綠界 API 配置
 */
export interface ECPayConfig {
  merchantID: string; // 特店編號
  hashKey: string; // 金鑰
  hashIV: string; // 向量
  isTestMode: boolean; // 測試模式
  returnURL: string; // 付款完成通知回傳網址
  clientBackURL?: string; // 付款完成後導向網址
  orderResultURL?: string; // 付款結果後的顯示頁面
}

/**
 * 綠界表單參數
 */
export interface ECPayFormParams {
  MerchantID: string;
  MerchantTradeNo: string;
  MerchantTradeDate: string;
  PaymentType: 'aio';
  TotalAmount: number;
  TradeDesc: string;
  ItemName: string;
  ReturnURL: string;
  ChoosePayment: ECPayPaymentMethod;
  ClientBackURL?: string;
  OrderResultURL?: string;
  NeedExtraPaidInfo?: string;
  CustomField1?: string;
  CustomField2?: string;
  CustomField3?: string;
  CustomField4?: string;
  CheckMacValue?: string;
  // ATM 專用參數
  ExpireDate?: string;
  PaymentInfoURL?: string;
  // CVS/BARCODE 專用參數
  StoreExpireDate?: string;
  Desc_1?: string;
  Desc_2?: string;
  Desc_3?: string;
  Desc_4?: string;
  // 定期定額專用參數
  PeriodAmount?: number;
  PeriodType?: PeriodType;
  Frequency?: number;
  ExecTimes?: number;
  PeriodReturnURL?: string;
}

/**
 * 綠界回傳參數
 */
export interface ECPayCallbackParams {
  MerchantID: string;
  MerchantTradeNo: string;
  RtnCode: number;
  RtnMsg: string;
  TradeNo: string;
  TradeAmt: number;
  PaymentDate: string;
  PaymentType: string;
  PaymentTypeChargeFee: string;
  TradeDate: string;
  CheckMacValue: string;
  // ATM 回傳參數
  BankCode?: string;
  vAccount?: string;
  ExpireDate?: string;
  // CVS 回傳參數
  PaymentNo?: string;
  StoreType?: string;
  // 定期定額回傳參數
  PeriodType?: PeriodType;
  Frequency?: number;
  ExecTimes?: number;
  PeriodAmount?: number;
  amount?: number;
  gwsr?: number;
  process_date?: string;
  auth_code?: string;
}
