import { Controller, Post, Body, Req, Res, Logger, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentGatewayManager } from '../domain/services/payment/payment-gateway-manager.service';
import { ECPayCallbackParams } from '../domain/interfaces/payment/ecpay.interface';

/**
 * ECPay Webhook 控制器
 * 處理綠界支付的回調通知
 */
@Controller('webhooks/ecpay')
export class ECPayWebhookController {
  private readonly logger = new Logger(ECPayWebhookController.name);

  constructor(private readonly paymentGatewayManager: PaymentGatewayManager) {}

  /**
   * 處理 ECPay 支付結果回調
   */
  @Post()
  async handlePaymentCallback(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    this.logger.log('Received ECPay payment callback', {
      merchantTradeNo: body.MerchantTradeNo,
      tradeNo: body.TradeNo,
      rtnCode: body.RtnCode,
      ip: req.ip,
    });

    try {
      // 獲取 ECPay 閘道
      const ecpayGateway = this.paymentGatewayManager.getGateway('ecpay');
      if (!ecpayGateway) {
        throw new BadRequestException('ECPay gateway not available');
      }

      // 處理 Webhook
      const result = await ecpayGateway.handleWebhook(body);

      if (!result.success) {
        this.logger.error('ECPay webhook processing failed', {
          merchantTradeNo: body.MerchantTradeNo,
          error: result.errorMessage,
        });

        // ECPay 要求回應 "0|失敗原因"
        res.status(400).send(`0|${result.errorMessage || 'Processing failed'}`);
        return;
      }

      // 根據回調結果執行業務邏輯
      await this.processPaymentResult(body as ECPayCallbackParams, result);

      this.logger.log('ECPay payment callback processed successfully', {
        merchantTradeNo: body.MerchantTradeNo,
        eventType: result.eventType,
        status: result.status,
      });

      // ECPay 要求成功時回應 "1|OK"
      res.status(200).send('1|OK');
    } catch (error) {
      this.logger.error('ECPay webhook processing error', error, {
        merchantTradeNo: body.MerchantTradeNo,
        body: JSON.stringify(body, null, 2),
      });

      // ECPay 要求回應 "0|失敗原因"
      res.status(500).send(`0|${error.message || 'Internal server error'}`);
    }
  }

  /**
   * 處理支付結果的業務邏輯
   */
  private async processPaymentResult(params: ECPayCallbackParams, _webhookResult: any) {
    const { MerchantTradeNo, RtnCode, TradeAmt, PaymentDate, PaymentType } = params;

    try {
      // 根據回傳碼處理不同狀況
      if (RtnCode === 1) {
        // 支付成功
        this.logger.log('Payment successful', {
          merchantTradeNo: MerchantTradeNo,
          amount: TradeAmt,
          paymentDate: PaymentDate,
          paymentType: PaymentType,
        });

        // TODO: 更新訂單狀態、發送通知等業務邏輯
        await this.updateOrderStatus(MerchantTradeNo, 'paid', {
          amount: TradeAmt,
          paymentDate: PaymentDate,
          paymentType: PaymentType,
          tradeNo: params.TradeNo,
        });
      } else {
        // 支付失敗
        this.logger.warn('Payment failed', {
          merchantTradeNo: MerchantTradeNo,
          rtnCode: RtnCode,
          rtnMsg: params.RtnMsg,
        });

        // TODO: 更新訂單狀態為失敗
        await this.updateOrderStatus(MerchantTradeNo, 'failed', {
          errorCode: RtnCode,
          errorMessage: params.RtnMsg,
        });
      }

      // 處理特殊支付方式的額外資訊
      await this.handleSpecialPaymentMethods(params);
    } catch (error) {
      this.logger.error('Error processing payment result', error, {
        merchantTradeNo: MerchantTradeNo,
      });
      throw error;
    }
  }

  /**
   * 更新訂單狀態
   */
  private async updateOrderStatus(merchantTradeNo: string, status: string, metadata?: any) {
    // TODO: 實作訂單狀態更新邏輯
    this.logger.debug('Updating order status', {
      merchantTradeNo,
      status,
      metadata,
    });

    // 這裡應該調用訂單服務更新狀態
    // await this.orderService.updateStatus(merchantTradeNo, status, metadata);
  }

  /**
   * 處理特殊支付方式的額外資訊
   */
  private async handleSpecialPaymentMethods(params: ECPayCallbackParams) {
    const { PaymentType } = params;

    switch (PaymentType) {
      case 'ATM_TAISHIN':
      case 'ATM_ESUN':
      case 'ATM_BOT':
      case 'ATM_FUBON':
      case 'ATM_CHINATRUST':
      case 'ATM_FIRST':
        // ATM 轉帳 - 可能有虛擬帳號資訊
        if (params.BankCode && params.vAccount) {
          this.logger.log('ATM payment info', {
            merchantTradeNo: params.MerchantTradeNo,
            bankCode: params.BankCode,
            vAccount: params.vAccount,
            expireDate: params.ExpireDate,
          });
        }
        break;

      case 'CVS_CVS':
      case 'CVS_OK':
      case 'CVS_FAMILY':
      case 'CVS_HILIFE':
      case 'CVS_IBON':
        // 超商代碼繳費 - 可能有繳費代號
        if (params.PaymentNo) {
          this.logger.log('CVS payment info', {
            merchantTradeNo: params.MerchantTradeNo,
            paymentNo: params.PaymentNo,
            expireDate: params.ExpireDate,
          });
        }
        break;

      case 'BARCODE_BARCODE':
        // 超商條碼繳費
        // Note: 條碼資訊通常在不同的回調中提供
        this.logger.log('Barcode payment detected', {
          merchantTradeNo: params.MerchantTradeNo,
          expireDate: params.ExpireDate,
        });
        break;

      default:
        // 信用卡等其他支付方式
        break;
    }
  }
}
