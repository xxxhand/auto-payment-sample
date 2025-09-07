import { Injectable } from '@nestjs/common';

export interface Account {
  id: string;
  customerId: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    avatar?: string;
  };
  billing: {
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    taxId?: string;
    currency: string;
    timezone: string;
  };
  preferences: {
    language: string;
    notifications: {
      email: boolean;
      sms: boolean;
      marketing: boolean;
    };
    billingFrequency: 'monthly' | 'quarterly' | 'yearly';
  };
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  customerId: string;
  type: 'CREDIT_CARD' | 'BANK_ACCOUNT' | 'DIGITAL_WALLET';
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  isDefault: boolean;
  details: {
    last4: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    holderName: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 帳戶管理服務
 * 負責客戶帳戶資料和付款方式管理
 */
@Injectable()
export class AccountService {
  private readonly accounts: Account[] = [
    {
      id: 'acc_123',
      customerId: 'cust_123',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company: 'Tech Corp',
      },
      billing: {
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'US',
        },
        currency: 'USD',
        timezone: 'America/Los_Angeles',
      },
      preferences: {
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          marketing: true,
        },
        billingFrequency: 'monthly',
      },
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
    },
    {
      id: 'acc_456',
      customerId: 'cust_456',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+0987654321',
      },
      billing: {
        address: {
          street: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
        },
        currency: 'USD',
        timezone: 'America/New_York',
      },
      preferences: {
        language: 'en',
        notifications: {
          email: true,
          sms: true,
          marketing: false,
        },
        billingFrequency: 'yearly',
      },
      status: 'ACTIVE',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-20T14:00:00Z',
    },
  ];

  private readonly paymentMethods: PaymentMethod[] = [
    {
      id: 'pm_001',
      customerId: 'cust_123',
      type: 'CREDIT_CARD',
      status: 'ACTIVE',
      isDefault: true,
      details: {
        last4: '4242',
        brand: 'Visa',
        expiryMonth: 12,
        expiryYear: 2025,
        holderName: 'John Doe',
      },
      billingAddress: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        country: 'US',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'pm_002',
      customerId: 'cust_456',
      type: 'CREDIT_CARD',
      status: 'ACTIVE',
      isDefault: true,
      details: {
        last4: '1234',
        brand: 'Mastercard',
        expiryMonth: 8,
        expiryYear: 2026,
        holderName: 'Jane Smith',
      },
      billingAddress: {
        street: '456 Oak Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
      },
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
    },
  ];

  /**
   * 取得帳戶資料
   */
  public async getAccount(customerId: string): Promise<{ account: Account | null }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const account = this.accounts.find((acc) => acc.customerId === customerId);
    return { account: account || null };
  }

  /**
   * 更新帳戶資料
   */
  public async updateAccount(customerId: string, updateData: Partial<Omit<Account, 'id' | 'customerId' | 'createdAt'>>): Promise<{ account: Account; updated: boolean }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const accountIndex = this.accounts.findIndex((acc) => acc.customerId === customerId);
    if (accountIndex === -1) {
      throw new Error('Account not found');
    }

    const account = this.accounts[accountIndex];
    const updatedAccount: Account = {
      ...account,
      ...updateData,
      id: account.id,
      customerId: account.customerId,
      createdAt: account.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.accounts[accountIndex] = updatedAccount;

    return { account: updatedAccount, updated: true };
  }

  /**
   * 取得付款方式列表
   */
  public async getPaymentMethods(customerId: string): Promise<{ paymentMethods: PaymentMethod[] }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const methods = this.paymentMethods.filter((pm) => pm.customerId === customerId && pm.status === 'ACTIVE').sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

    return { paymentMethods: methods };
  }

  /**
   * 新增付款方式
   */
  public async addPaymentMethod(
    customerId: string,
    paymentData: { type: string; cardNumber: string; expiryMonth: number; expiryYear: number; cvv: string; holderName: string; billingAddress: PaymentMethod['billingAddress'] },
  ): Promise<{ paymentMethod: PaymentMethod; success: boolean }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // 驗證卡號（模擬）
    if (!paymentData.cardNumber || paymentData.cardNumber.length < 16) {
      throw new Error('Invalid card number');
    }

    // 驗證到期日
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    if (paymentData.expiryYear < currentYear || (paymentData.expiryYear === currentYear && paymentData.expiryMonth < currentMonth)) {
      throw new Error('Card has expired');
    }

    const paymentMethodId = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const last4 = paymentData.cardNumber.slice(-4);
    const brand = this.detectCardBrand(paymentData.cardNumber);

    // 如果是第一張卡，設為預設
    const existingMethods = this.paymentMethods.filter((pm) => pm.customerId === customerId && pm.status === 'ACTIVE');
    const isDefault = existingMethods.length === 0;

    const newPaymentMethod: PaymentMethod = {
      id: paymentMethodId,
      customerId,
      type: 'CREDIT_CARD',
      status: 'ACTIVE',
      isDefault,
      details: {
        last4,
        brand,
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
        holderName: paymentData.holderName,
      },
      billingAddress: paymentData.billingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentMethods.push(newPaymentMethod);

    return { paymentMethod: newPaymentMethod, success: true };
  }

  /**
   * 刪除付款方式
   */
  public async deletePaymentMethod(customerId: string, paymentMethodId: string): Promise<{ success: boolean; message: string }> {
    if (!customerId || !paymentMethodId) {
      throw new Error('Customer ID and payment method ID are required');
    }

    const methodIndex = this.paymentMethods.findIndex((pm) => pm.id === paymentMethodId && pm.customerId === customerId);
    if (methodIndex === -1) {
      throw new Error('Payment method not found');
    }

    const paymentMethod = this.paymentMethods[methodIndex];
    if (paymentMethod.isDefault) {
      const otherActiveMethods = this.paymentMethods.filter((pm) => pm.customerId === customerId && pm.id !== paymentMethodId && pm.status === 'ACTIVE');
      if (otherActiveMethods.length === 0) {
        throw new Error('Cannot delete the only payment method. Please add another payment method first.');
      }
    }

    // 軟刪除 - 標記為禁用
    this.paymentMethods[methodIndex].status = 'DISABLED';
    this.paymentMethods[methodIndex].updatedAt = new Date().toISOString();

    // 如果刪除的是預設付款方式，設定其他方式為預設
    if (paymentMethod.isDefault) {
      const nextDefaultIndex = this.paymentMethods.findIndex((pm) => pm.customerId === customerId && pm.status === 'ACTIVE' && pm.id !== paymentMethodId);
      if (nextDefaultIndex !== -1) {
        this.paymentMethods[nextDefaultIndex].isDefault = true;
        this.paymentMethods[nextDefaultIndex].updatedAt = new Date().toISOString();
      }
    }

    return { success: true, message: 'Payment method deleted successfully' };
  }

  /**
   * 設定預設付款方式
   */
  public async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<{ success: boolean; message: string }> {
    if (!customerId || !paymentMethodId) {
      throw new Error('Customer ID and payment method ID are required');
    }

    const method = this.paymentMethods.find((pm) => pm.id === paymentMethodId && pm.customerId === customerId && pm.status === 'ACTIVE');
    if (!method) {
      throw new Error('Payment method not found or inactive');
    }

    // 移除其他預設設定
    this.paymentMethods
      .filter((pm) => pm.customerId === customerId && pm.status === 'ACTIVE')
      .forEach((pm) => {
        pm.isDefault = pm.id === paymentMethodId;
        pm.updatedAt = new Date().toISOString();
      });

    return { success: true, message: 'Default payment method updated successfully' };
  }

  /**
   * 更新帳戶偏好設定
   */
  public async updatePreferences(customerId: string, preferences: Partial<Account['preferences']>): Promise<{ preferences: Account['preferences']; updated: boolean }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const accountIndex = this.accounts.findIndex((acc) => acc.customerId === customerId);
    if (accountIndex === -1) {
      throw new Error('Account not found');
    }

    const account = this.accounts[accountIndex];
    account.preferences = { ...account.preferences, ...preferences };
    account.updatedAt = new Date().toISOString();

    return { preferences: account.preferences, updated: true };
  }

  /**
   * 取得帳戶概覽
   */
  public async getAccountSummary(
    customerId: string,
  ): Promise<{ profile: Account['profile']; billing: Account['billing']; paymentMethodsCount: number; subscriptionsCount: number; lastLoginAt?: string }> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const account = this.accounts.find((acc) => acc.customerId === customerId);
    if (!account) {
      throw new Error('Account not found');
    }

    const activePaymentMethods = this.paymentMethods.filter((pm) => pm.customerId === customerId && pm.status === 'ACTIVE').length;

    // 模擬訂閱數量
    const subscriptionsCount = 2;

    return {
      profile: account.profile,
      billing: account.billing,
      paymentMethodsCount: activePaymentMethods,
      subscriptionsCount,
      lastLoginAt: '2024-01-20T10:30:00Z',
    };
  }

  /**
   * 偵測信用卡品牌
   */
  private detectCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\D/g, '');
    
    if (number.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'Mastercard';
    if (/^3[47]/.test(number)) return 'American Express';
    if (/^6/.test(number)) return 'Discover';
    
    return 'Unknown';
  }
}
