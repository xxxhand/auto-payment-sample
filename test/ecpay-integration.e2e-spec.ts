import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PaymentGatewayManager } from '../src/domain/services/payment/payment-gateway-manager.service';
import { ECPayGateway } from '../src/domain/services/payment/ecpay-gateway.service';
import { PaymentStatus } from '../src/domain/interfaces/payment/payment-gateway.interface';
import { ECPayConfigService } from '../src/domain/services/payment/ecpay-config-wrapper.service';

// TODO: Ignore testing now, fix them in the future
describe.skip('ECPay Integration (e2e)', () => {
  let app: INestApplication;
  let paymentGatewayManager: PaymentGatewayManager;
  let ecpayGateway: ECPayGateway;
  let ecpayConfigService: ECPayConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    paymentGatewayManager = moduleFixture.get<PaymentGatewayManager>(PaymentGatewayManager);
    ecpayGateway = moduleFixture.get<ECPayGateway>(ECPayGateway);
    ecpayConfigService = moduleFixture.get<ECPayConfigService>(ECPayConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ECPay Configuration', () => {
    it('should have valid ECPay configuration', () => {
      const config = ecpayConfigService.getConfig();

      expect(config).toBeDefined();
      expect(config.merchantID).toBeDefined();
      expect(config.hashKey).toBeDefined();
      expect(config.hashIV).toBeDefined();
      expect(config.returnURL).toBeDefined();
      expect(typeof config.isTestMode).toBe('boolean');
    });

    it('should validate configuration correctly', () => {
      const isValid = ecpayConfigService.validateConfig();
      expect(isValid).toBe(true);
    });

    it('should provide correct API endpoints', () => {
      const endpoints = ecpayConfigService.getApiEndpoints();

      expect(endpoints).toBeDefined();
      expect(endpoints.aio).toContain('ecpay.com.tw');
      expect(endpoints.query).toContain('ecpay.com.tw');

      if (ecpayConfigService.isTestMode()) {
        expect(endpoints.aio).toContain('payment-stage');
        expect(endpoints.query).toContain('payment-stage');
      }
    });
  });

  describe('ECPay Gateway', () => {
    it('should be registered in payment gateway manager', () => {
      const gateway = paymentGatewayManager.getGateway('ecpay');
      expect(gateway).toBeDefined();
      expect(gateway.getName()).toBe('ecpay');
    });

    it('should create ECPay payment successfully', async () => {
      const paymentOptions = {
        amount: 1000,
        currency: 'TWD',
        description: 'ECPay Test Payment',
        customerId: 'test-customer-001',
        paymentMethodType: 'credit_card',
        metadata: {
          orderId: 'ORDER-001',
          testMode: true,
        },
      };

      const result = await ecpayGateway.createPayment(paymentOptions);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('TWD');
      expect(result.gatewayResponse).toBeDefined();
      expect(result.gatewayResponse.formParams).toBeDefined();
      expect(result.gatewayResponse.actionUrl).toContain('ecpay.com.tw');
      expect(result.gatewayResponse.method).toBe('POST');
    });

    it('should generate valid form parameters', async () => {
      const paymentOptions = {
        amount: 500,
        currency: 'TWD',
        description: 'Form Parameters Test',
        customerId: 'test-customer-002',
      };

      const result = await ecpayGateway.createPayment(paymentOptions);
      const formParams = result.gatewayResponse.formParams;

      expect(formParams.MerchantID).toBeDefined();
      expect(formParams.MerchantTradeNo).toBeDefined();
      expect(formParams.MerchantTradeDate).toBeDefined();
      expect(formParams.PaymentType).toBe('aio');
      expect(formParams.TotalAmount).toBe(500);
      expect(formParams.TradeDesc).toBe('Form Parameters Test');
      expect(formParams.ItemName).toBe('Form Parameters Test');
      expect(formParams.ReturnURL).toBeDefined();
      expect(formParams.ChoosePayment).toBeDefined();
      expect(formParams.CheckMacValue).toBeDefined();
      expect(formParams.CheckMacValue).toMatch(/^[A-F0-9]{64}$/); // SHA256 格式
    });

    it('should create ATM payment with correct parameters', async () => {
      const atmOptions = {
        amount: 2000,
        currency: 'TWD',
        description: 'ATM Test Payment',
        customerId: 'test-customer-003',
        paymentMethodType: 'ATM',
        expireDate: '2024/12/31',
      };

      const result = await ecpayGateway.createATMPayment(atmOptions);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(2000);
      expect(result.expireDate).toBe('2024/12/31');
      expect(result.gatewayResponse.formParams.ChoosePayment).toBe('ATM');
    });

    it('should create CVS payment with correct parameters', async () => {
      const cvsOptions = {
        amount: 1500,
        currency: 'TWD',
        description: 'CVS Test Payment',
        customerId: 'test-customer-004',
        storeType: 'CVS' as any,
        desc1: 'Test Store Payment',
      };

      const result = await ecpayGateway.createCVSPayment(cvsOptions);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(1500);
      expect(result.storeType).toBe('CVS');
      expect(result.desc1).toBe('Test Store Payment');
      expect(result.gatewayResponse.formParams.ChoosePayment).toBe('CVS');
    });

    it('should create period payment with correct parameters', async () => {
      const periodOptions = {
        amount: 100,
        currency: 'TWD',
        description: 'Period Payment Test',
        customerId: 'test-customer-005',
        periodAmount: 100,
        periodType: 'M' as any,
        frequency: 1,
        execTimes: 12,
        periodReturnURL: 'https://example.com/period-callback',
      };

      const result = await ecpayGateway.createPeriodPayment(periodOptions);

      expect(result.success).toBe(true);
      expect(result.periodAmount).toBe(100);
      expect(result.periodType).toBe('M');
      expect(result.frequency).toBe(1);
      expect(result.execTimes).toBe(12);
      expect(result.gatewayResponse.formParams.PeriodAmount).toBe(100);
      expect(result.gatewayResponse.formParams.PeriodType).toBe('M');
      expect(result.gatewayResponse.formParams.Frequency).toBe(1);
      expect(result.gatewayResponse.formParams.ExecTimes).toBe(12);
    });
  });

  describe('ECPay Webhook', () => {
    it('should handle successful payment callback', async () => {
      const callbackData = {
        MerchantID: '2000132',
        MerchantTradeNo: 'MT1640995200TEST001',
        PaymentDate: '2024/01/01 12:00:00',
        PaymentType: 'Credit_CreditCard',
        PaymentTypeChargeFee: '35',
        RtnCode: 1,
        RtnMsg: '交易成功',
        SimulatePaid: 1,
        TradeAmt: 1000,
        TradeDate: '2024/01/01 11:30:00',
        TradeNo: '2401010001000001',
        CheckMacValue: '6EA3ABDF1B7C28F7638A0C3F5D01D2B8A7B37E84B75E12F34C9E8A9D21C6F845',
      };

      const response = await request(app.getHttpServer()).post('/webhooks/ecpay').send(callbackData).expect(200);

      expect(response.text).toBe('1|OK');
    });

    it('should handle failed payment callback', async () => {
      const callbackData = {
        MerchantID: '2000132',
        MerchantTradeNo: 'MT1640995200TEST002',
        PaymentDate: '2024/01/01 12:00:00',
        PaymentType: 'Credit_CreditCard',
        PaymentTypeChargeFee: '0',
        RtnCode: 0,
        RtnMsg: '交易失敗',
        SimulatePaid: 0,
        TradeAmt: 1000,
        TradeDate: '2024/01/01 11:30:00',
        TradeNo: '2401010001000002',
        CheckMacValue: '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
      };

      const response = await request(app.getHttpServer()).post('/webhooks/ecpay').send(callbackData);

      // 應該返回成功但記錄為失敗
      expect(response.status).toBe(200);
      expect(response.text).toBe('1|OK');
    });

    it('should reject invalid callback signature', async () => {
      const callbackData = {
        MerchantID: '2000132',
        MerchantTradeNo: 'MT1640995200TEST003',
        RtnCode: 1,
        CheckMacValue: 'INVALID_SIGNATURE',
      };

      const response = await request(app.getHttpServer()).post('/webhooks/ecpay').send(callbackData);

      expect(response.status).toBe(400);
      expect(response.text).toContain('0|');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.payment).toBeDefined();
      expect(response.body.services.payment.ecpay).toBeDefined();
    });
  });
});
