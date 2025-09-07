import { Injectable } from '@nestjs/common';

export interface Product {
  productId: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  pricing: {
    amount: number;
    currency: string;
    setup_fee?: number;
  };
  billing: {
    interval: 'MONTHLY' | 'YEARLY';
    trial_period_days?: number;
  };
  features: string[];
  metadata?: {
    tier?: string;
    popular?: boolean;
    category?: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * 產品管理服務
 * 負責產品目錄、定價和功能管理
 */
@Injectable()
export class ProductService {
  private readonly products: Product[] = [
    {
      productId: 'prod_basic_monthly',
      name: 'Basic Monthly',
      description: 'Basic plan with essential features',
      status: 'ACTIVE',
      pricing: { amount: 299, currency: 'TWD' },
      billing: { interval: 'MONTHLY', trial_period_days: 7 },
      features: ['Basic Features', 'Email Support', 'Up to 5 Projects'],
      metadata: { tier: 'basic', popular: false },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      productId: 'prod_premium_monthly',
      name: 'Premium Monthly',
      description: 'Premium plan with advanced features',
      status: 'ACTIVE',
      pricing: { amount: 999, currency: 'TWD' },
      billing: { interval: 'MONTHLY', trial_period_days: 14 },
      features: ['All Basic Features', 'Priority Support', 'Unlimited Projects', 'Analytics'],
      metadata: { tier: 'premium', popular: true },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      productId: 'prod_enterprise_monthly',
      name: 'Enterprise Monthly',
      description: 'Enterprise plan for large organizations',
      status: 'ACTIVE',
      pricing: { amount: 2999, currency: 'TWD', setup_fee: 1000 },
      billing: { interval: 'MONTHLY' },
      features: ['All Premium Features', 'Dedicated Account Manager', 'Unlimited Projects', 'SLA Guarantee', 'Custom Reporting'],
      metadata: { tier: 'enterprise', popular: false },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      productId: 'prod_basic_yearly',
      name: 'Basic Yearly',
      description: 'Basic plan with yearly billing (20% discount)',
      status: 'ACTIVE',
      pricing: { amount: 2874, currency: 'TWD' },
      billing: { interval: 'YEARLY', trial_period_days: 30 },
      features: ['Basic Features', 'Email Support', 'Up to 5 Projects', 'Yearly Billing Discount'],
      metadata: { tier: 'basic', popular: false },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  /**
   * 取得所有產品
   */
  public async getAllProducts(filters?: { status?: string; billing_interval?: string; tier?: string }): Promise<{ products: Product[] }> {
    let filteredProducts = [...this.products];

    if (filters?.status) {
      filteredProducts = filteredProducts.filter((product) => product.status === filters.status);
    }

    if (filters?.billing_interval) {
      filteredProducts = filteredProducts.filter((product) => product.billing.interval === filters.billing_interval);
    }

    if (filters?.tier) {
      filteredProducts = filteredProducts.filter((product) => product.metadata?.tier === filters.tier);
    }

    return { products: filteredProducts };
  }

  /**
   * 根據ID取得產品
   */
  public async getProductById(productId: string): Promise<{ product: Product | null }> {
    const product = this.products.find((p) => p.productId === productId);
    return { product: product || null };
  }

  /**
   * 取得升級選項
   */
  public async getUpgradeOptions(currentProductId: string): Promise<{ upgradeOptions: Product[] }> {
    const currentProduct = this.products.find((p) => p.productId === currentProductId);
    if (!currentProduct) {
      return { upgradeOptions: [] };
    }

    const upgradeOptions = this.products
      .filter(
        (product) =>
          product.productId !== currentProductId &&
          product.status === 'ACTIVE' &&
          product.billing.interval === currentProduct.billing.interval &&
          product.pricing.amount > currentProduct.pricing.amount,
      )
      .sort((a, b) => a.pricing.amount - b.pricing.amount);

    return { upgradeOptions };
  }

  /**
   * 驗證產品是否有效
   */
  public async validateProduct(productId: string): Promise<{ valid: boolean; product?: Product; reason?: string }> {
    const product = this.products.find((p) => p.productId === productId);

    if (!product) {
      return { valid: false, reason: 'Product not found' };
    }

    if (product.status !== 'ACTIVE') {
      return { valid: false, product, reason: 'Product is not active' };
    }

    return { valid: true, product };
  }

  /**
   * 取得熱門產品
   */
  public async getPopularProducts(): Promise<{ products: Product[] }> {
    const popularProducts = this.products.filter((product) => product.status === 'ACTIVE' && product.metadata?.popular === true);

    return { products: popularProducts };
  }

  /**
   * 根據計費週期取得產品
   */
  public async getProductsByBillingInterval(interval: 'MONTHLY' | 'YEARLY'): Promise<{ products: Product[] }> {
    const products = this.products.filter((product) => product.status === 'ACTIVE' && product.billing.interval === interval);

    return { products };
  }

  /**
   * 計算升級費用
   */
  public async calculateUpgradeCost(
    fromProductId: string,
    toProductId: string,
    prorationDays?: number,
  ): Promise<{ upgradeCost: number; prorationCredit: number; totalCost: number; currency: string }> {
    const fromProduct = this.products.find((p) => p.productId === fromProductId);
    const toProduct = this.products.find((p) => p.productId === toProductId);

    if (!fromProduct || !toProduct) {
      throw new Error('One or both products not found');
    }

    const upgradeCost = toProduct.pricing.amount - fromProduct.pricing.amount;
    let prorationCredit = 0;

    if (prorationDays && prorationDays > 0) {
      const daysInBilling = fromProduct.billing.interval === 'MONTHLY' ? 30 : 365;
      prorationCredit = Math.round((fromProduct.pricing.amount / daysInBilling) * prorationDays);
    }

    const totalCost = Math.max(0, upgradeCost - prorationCredit);

    return {
      upgradeCost,
      prorationCredit,
      totalCost,
      currency: toProduct.pricing.currency,
    };
  }
}
