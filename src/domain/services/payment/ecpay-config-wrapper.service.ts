import { Injectable } from '@nestjs/common';
import { ConfService } from '../../../../libs/conf/src/conf.service';
import { ECPayConfig } from '../../interfaces/payment/ecpay.interface';

/**
 * ECPay 配置服務
 * 整合到統一配置系統中
 */
@Injectable()
export class ECPayConfigService {
  constructor(private readonly confService: ConfService) {}

  /**
   * 獲取 ECPay 配置
   */
  getConfig(): ECPayConfig {
    const config = this.confService.getConf();
    return {
      merchantID: config.ecpay.merchantID,
      hashKey: config.ecpay.hashKey,
      hashIV: config.ecpay.hashIV,
      isTestMode: config.ecpay.isTestMode,
      returnURL: config.ecpay.returnURL,
      clientBackURL: config.ecpay.clientBackURL,
      orderResultURL: config.ecpay.orderResultURL,
    };
  }

  /**
   * 驗證配置是否完整
   */
  validateConfig(): boolean {
    const config = this.getConfig();

    if (!config.merchantID || !config.hashKey || !config.hashIV || !config.returnURL) {
      return false;
    }

    return true;
  }

  /**
   * 獲取 API 端點
   */
  getApiEndpoints() {
    const config = this.confService.getConf();
    return config.ecpay.apiEndpoints;
  }

  /**
   * 檢查是否為測試模式
   */
  isTestMode(): boolean {
    return this.getConfig().isTestMode;
  }
}
