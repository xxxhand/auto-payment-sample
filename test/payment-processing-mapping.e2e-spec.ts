import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProcessingService } from '../src/domain/services/payment-processing.service';
import { PaymentGatewayManager } from '../src/domain/services/payment/payment-gateway-manager.service';
import { PaymentMethodRepository } from '../src/infra/repositories/payment-method.repository';
import { PaymentService } from '../src/domain/services/payment.service';
import { Money } from '../src/domain/value-objects/money';
import { PaymentFailureCategory } from '../src/domain/enums/codes.const';
import { PaymentStatus } from '../src/domain/interfaces/payment/payment-gateway.interface';

describe('PaymentProcessingService failure category mapping (e2e-lite)', () => {
  let service: PaymentProcessingService;

  const gatewayMock = {
    processPayment: jest.fn(),
  } as unknown as PaymentGatewayManager;

  const paymentMethodRepoMock = {
    findById: jest.fn(async (id: string) => ({
      id,
      customerId: 'cus_test',
      type: 'CREDIT_CARD',
      isAvailable: () => true,
    })),
  } as unknown as PaymentMethodRepository;

  const paymentServiceStub = {
    // Not used in these tests
  } as unknown as PaymentService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProcessingService,
        { provide: PaymentGatewayManager, useValue: gatewayMock },
        { provide: PaymentMethodRepository, useValue: paymentMethodRepoMock },
        { provide: PaymentService, useValue: paymentServiceStub },
      ],
    }).compile();

    service = module.get(PaymentProcessingService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps CARD_DECLINED to NON_RETRIABLE', async () => {
    (gatewayMock.processPayment as any).mockResolvedValue({
      success: false,
      paymentId: 'gw_txn_1',
      status: PaymentStatus.FAILED,
      amount: 1000,
      currency: 'TWD',
      errorCode: 'CARD_DECLINED',
      errorMessage: 'Card was declined',
      gatewayResponse: {},
    });

    const result = await service.processPayment('pay_1', 'pm_1', new Money(1000, 'TWD'));
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe(PaymentFailureCategory.NON_RETRIABLE);
    expect(result.isRetriable).toBe(false);
  });

  it('maps INSUFFICIENT_FUNDS to DELAYED_RETRY', async () => {
    (gatewayMock.processPayment as any).mockResolvedValue({
      success: false,
      paymentId: 'gw_txn_2',
      status: PaymentStatus.FAILED,
      amount: 1000,
      currency: 'TWD',
      errorCode: 'INSUFFICIENT_FUNDS',
      errorMessage: 'Insufficient funds',
      gatewayResponse: {},
    });

    const result = await service.processPayment('pay_2', 'pm_2', new Money(1000, 'TWD'));
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe(PaymentFailureCategory.DELAYED_RETRY);
    expect(result.isRetriable).toBe(true);
  });

  it('maps GATEWAY_TIMEOUT to RETRIABLE', async () => {
    (gatewayMock.processPayment as any).mockResolvedValue({
      success: false,
      paymentId: 'gw_txn_3',
      status: PaymentStatus.FAILED,
      amount: 1000,
      currency: 'TWD',
      errorCode: 'GATEWAY_TIMEOUT',
      errorMessage: 'Timeout',
      gatewayResponse: {},
    });

    const result = await service.processPayment('pay_3', 'pm_3', new Money(1000, 'TWD'));
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe(PaymentFailureCategory.RETRIABLE);
    expect(result.isRetriable).toBe(true);
  });

  it('defaults FAILED without code to NON_RETRIABLE', async () => {
    (gatewayMock.processPayment as any).mockResolvedValue({
      success: false,
      paymentId: 'gw_txn_4',
      status: PaymentStatus.FAILED,
      amount: 1000,
      currency: 'TWD',
      gatewayResponse: {},
    });

    const result = await service.processPayment('pay_4', 'pm_4', new Money(1000, 'TWD'));
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe(PaymentFailureCategory.NON_RETRIABLE);
    expect(result.isRetriable).toBe(false);
  });
});
