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
    tags?: string[];
    weight?: number;
    priority?: number;
  };
  lifecycle?: ProductLifecycle;
  created_at: string;
  updated_at: string;
}

export interface ProductFilters {
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  billingInterval?: 'MONTHLY' | 'YEARLY';
  includeInactive?: boolean;
  tier?: string;
  minPrice?: number;
  maxPrice?: number;
  hasTrialPeriod?: boolean;
  searchTerm?: string;
  tags?: string[];
  category?: string;
}

export interface ProductAnalytics {
  totalActiveProducts: number;
  totalInactiveProducts: number;
  averageMonthlyPrice: number;
  averageYearlyPrice: number;
  mostPopularTier: string;
  priceDistribution: {
    tier: string;
    count: number;
    averagePrice: number;
  }[];
  revenueProjection: {
    monthly: number;
    yearly: number;
  };
}

export interface PricingStrategy {
  discountPercentage: number;
  minimumPrice: number;
  maximumDiscount: number;
  tierMultipliers: {
    basic: number;
    premium: number;
    enterprise: number;
  };
}

export interface ProductLifecycle {
  phase: 'BETA' | 'ACTIVE' | 'MATURE' | 'DEPRECATED' | 'END_OF_LIFE';
  launchDate: string;
  lastUpdated: string;
  deprecationDate?: string;
  endOfLifeDate?: string;
  migrationPath?: string;
}

export interface UpgradeOption {
  fromProductId: string;
  toProductId: string;
  toProduct: Product;
  priceDifference: number;
  features: string[];
}

/**
 * 產品管理服務
 * 負責產品目錄、定價和功能管理
 * Phase 4.2: 從模擬數據遷移到真實業務邏輯
 */
@Injectable()
export class ProductService {
  private readonly pricingStrategy: PricingStrategy = {
    discountPercentage: 20,
    minimumPrice: 100,
    maximumDiscount: 50,
    tierMultipliers: {
      basic: 1.0,
      premium: 3.0,
      enterprise: 8.0,
    },
  };

  // TODO: Phase 4.2 - Replace with ProductRepository
  private readonly products: Product[] = [
    {
      productId: 'prod_basic_monthly',
      name: 'Basic Monthly',
      description: 'Basic plan with essential features',
      status: 'ACTIVE',
      pricing: { amount: 299, currency: 'TWD' },
      billing: { interval: 'MONTHLY', trial_period_days: 7 },
      features: ['Basic Features', 'Email Support', 'Up to 5 Projects'],
      metadata: {
        tier: 'basic',
        popular: false,
        category: 'subscription',
        tags: ['basic', 'monthly', 'starter'],
        weight: 1,
        priority: 3,
      },
      lifecycle: {
        phase: 'ACTIVE',
        launchDate: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      },
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
      metadata: {
        tier: 'premium',
        popular: true,
        category: 'subscription',
        tags: ['premium', 'monthly', 'popular'],
        weight: 3,
        priority: 1,
      },
      lifecycle: {
        phase: 'ACTIVE',
        launchDate: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-06-01T00:00:00Z',
      },
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
      metadata: {
        tier: 'enterprise',
        popular: false,
        category: 'enterprise',
        tags: ['enterprise', 'monthly', 'dedicated'],
        weight: 8,
        priority: 2,
      },
      lifecycle: {
        phase: 'MATURE',
        launchDate: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-03-01T00:00:00Z',
      },
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
      metadata: {
        tier: 'basic',
        popular: false,
        category: 'subscription',
        tags: ['basic', 'yearly', 'discount'],
        weight: 1,
        priority: 4,
      },
      lifecycle: {
        phase: 'ACTIVE',
        launchDate: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  /**
   * 取得所有產品 - Enhanced with advanced filtering
   */
  public async getAllProducts(filters?: ProductFilters): Promise<{ products: Product[] }> {
    let filteredProducts = [...this.products];

    // Status filter
    if (filters?.status) {
      filteredProducts = filteredProducts.filter((product) => product.status === filters.status);
    }

    // Billing interval filter
    if (filters?.billingInterval) {
      filteredProducts = filteredProducts.filter((product) => product.billing.interval === filters.billingInterval);
    }

    // Tier filter
    if (filters?.tier) {
      filteredProducts = filteredProducts.filter((product) => product.metadata?.tier === filters.tier);
    }

    // Price range filter
    if (filters?.minPrice !== undefined) {
      filteredProducts = filteredProducts.filter((product) => product.pricing.amount >= filters.minPrice!);
    }

    if (filters?.maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter((product) => product.pricing.amount <= filters.maxPrice!);
    }

    // Trial period filter
    if (filters?.hasTrialPeriod !== undefined) {
      filteredProducts = filteredProducts.filter((product) =>
        filters.hasTrialPeriod ? product.billing.trial_period_days && product.billing.trial_period_days > 0 : !product.billing.trial_period_days,
      );
    }

    // Search term filter
    if (filters?.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm) ||
          product.description.toLowerCase().includes(searchTerm) ||
          product.features.some((feature) => feature.toLowerCase().includes(searchTerm)),
      );
    }

    // Tags filter
    if (filters?.tags && filters.tags.length > 0) {
      filteredProducts = filteredProducts.filter((product) => filters.tags!.some((tag) => product.metadata?.tags?.includes(tag)));
    }

    // Category filter
    if (filters?.category) {
      filteredProducts = filteredProducts.filter((product) => product.metadata?.category === filters.category);
    }

    // Sort by priority and weight
    filteredProducts.sort((a, b) => {
      const priorityA = a.metadata?.priority || 999;
      const priorityB = b.metadata?.priority || 999;
      const weightA = a.metadata?.weight || 1;
      const weightB = b.metadata?.weight || 1;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return weightB - weightA;
    });

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

  /**
   * 獲取產品分析數據 - New Enhanced Method
   */
  public async getProductAnalytics(): Promise<ProductAnalytics> {
    const activeProducts = this.products.filter((p) => p.status === 'ACTIVE');
    const inactiveProducts = this.products.filter((p) => p.status !== 'ACTIVE');

    const monthlyProducts = activeProducts.filter((p) => p.billing.interval === 'MONTHLY');
    const yearlyProducts = activeProducts.filter((p) => p.billing.interval === 'YEARLY');

    const averageMonthlyPrice = monthlyProducts.length > 0 ? monthlyProducts.reduce((sum, p) => sum + p.pricing.amount, 0) / monthlyProducts.length : 0;

    const averageYearlyPrice = yearlyProducts.length > 0 ? yearlyProducts.reduce((sum, p) => sum + p.pricing.amount, 0) / yearlyProducts.length : 0;

    // Calculate tier distribution
    const tierCounts = activeProducts.reduce(
      (acc, product) => {
        const tier = product.metadata?.tier || 'unknown';
        if (!acc[tier]) {
          acc[tier] = { count: 0, totalPrice: 0 };
        }
        acc[tier].count += 1;
        acc[tier].totalPrice += product.pricing.amount;
        return acc;
      },
      {} as Record<string, { count: number; totalPrice: number }>,
    );

    const priceDistribution = Object.entries(tierCounts).map(([tier, data]) => ({
      tier,
      count: data.count,
      averagePrice: data.totalPrice / data.count,
    }));

    const mostPopularTier = priceDistribution.reduce((prev, current) => (prev.count > current.count ? prev : current), priceDistribution[0])?.tier || 'basic';

    // Calculate revenue projection
    const monthlyRevenue = monthlyProducts.reduce((sum, p) => sum + p.pricing.amount, 0);
    const yearlyRevenue = yearlyProducts.reduce((sum, p) => sum + p.pricing.amount, 0);

    return {
      totalActiveProducts: activeProducts.length,
      totalInactiveProducts: inactiveProducts.length,
      averageMonthlyPrice,
      averageYearlyPrice,
      mostPopularTier,
      priceDistribution,
      revenueProjection: {
        monthly: monthlyRevenue,
        yearly: yearlyRevenue,
      },
    };
  }

  /**
   * 應用定價策略 - New Enhanced Method
   */
  public async applyPricingStrategy(
    productId: string,
    discountPercentage?: number,
  ): Promise<{
    originalPrice: number;
    discountedPrice: number;
    discountAmount: number;
    currency: string;
  }> {
    const product = this.products.find((p) => p.productId === productId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const discount = discountPercentage || this.pricingStrategy.discountPercentage;
    const maxDiscount = this.pricingStrategy.maximumDiscount;
    const minPrice = this.pricingStrategy.minimumPrice;

    const appliedDiscount = Math.min(discount, maxDiscount);
    const discountAmount = Math.round((product.pricing.amount * appliedDiscount) / 100);
    const discountedPrice = Math.max(product.pricing.amount - discountAmount, minPrice);

    return {
      originalPrice: product.pricing.amount,
      discountedPrice,
      discountAmount: product.pricing.amount - discountedPrice,
      currency: product.pricing.currency,
    };
  }

  /**
   * 產品生命週期管理 - New Enhanced Method
   */
  public async updateProductLifecycle(
    productId: string,
    phase: ProductLifecycle['phase'],
  ): Promise<{
    success: boolean;
    product?: Product;
    message?: string;
  }> {
    const productIndex = this.products.findIndex((p) => p.productId === productId);
    if (productIndex === -1) {
      return { success: false, message: 'Product not found' };
    }

    const product = this.products[productIndex];
    const now = new Date().toISOString();

    // Update lifecycle
    if (!product.lifecycle) {
      product.lifecycle = {
        phase: 'BETA',
        launchDate: product.created_at,
        lastUpdated: now,
      };
    }

    product.lifecycle.phase = phase;
    product.lifecycle.lastUpdated = now;

    // Set dates based on phase
    switch (phase) {
      case 'DEPRECATED':
        if (!product.lifecycle.deprecationDate) {
          product.lifecycle.deprecationDate = now;
        }
        break;
      case 'END_OF_LIFE':
        if (!product.lifecycle.endOfLifeDate) {
          product.lifecycle.endOfLifeDate = now;
        }
        product.status = 'ARCHIVED';
        break;
    }

    product.updated_at = now;

    return { success: true, product };
  }

  /**
   * 智能產品推薦 - New Enhanced Method
   */
  public async getProductRecommendations(
    currentProductId?: string,
    customerTier?: string,
  ): Promise<{
    recommendations: Product[];
    reason: string;
  }> {
    let recommendations: Product[] = [];
    let reason = '';

    const activeProducts = this.products.filter((p) => p.status === 'ACTIVE');

    if (currentProductId) {
      const currentProduct = this.products.find((p) => p.productId === currentProductId);
      if (currentProduct) {
        // Recommend upgrades
        const upgrades = activeProducts
          .filter((p) => p.productId !== currentProductId && p.billing.interval === currentProduct.billing.interval && p.pricing.amount > currentProduct.pricing.amount)
          .sort((a, b) => a.pricing.amount - b.pricing.amount);

        if (upgrades.length > 0) {
          recommendations = upgrades.slice(0, 2);
          reason = 'Upgrade recommendations based on current subscription';
        }
      }
    }

    // If no current product or no upgrades available, recommend popular products
    if (recommendations.length === 0) {
      recommendations = activeProducts
        .filter((p) => p.metadata?.popular === true)
        .sort((a, b) => (a.metadata?.priority || 999) - (b.metadata?.priority || 999))
        .slice(0, 3);
      reason = 'Popular products recommendation';
    }

    // Filter by customer tier if provided
    if (customerTier && recommendations.length === 0) {
      recommendations = activeProducts
        .filter((p) => p.metadata?.tier === customerTier)
        .sort((a, b) => a.pricing.amount - b.pricing.amount)
        .slice(0, 2);
      reason = `Products matching ${customerTier} tier`;
    }

    return { recommendations, reason };
  }

  /**
   * 產品比較功能 - New Enhanced Method
   */
  public async compareProducts(productIds: string[]): Promise<{
    products: Product[];
    comparison: {
      priceRange: { min: number; max: number; currency: string };
      commonFeatures: string[];
      uniqueFeatures: Record<string, string[]>;
      trialComparison: Record<string, number | null>;
      recommendations: string[];
    };
  }> {
    const products = this.products.filter((p) => productIds.includes(p.productId));

    if (products.length === 0) {
      throw new Error('No valid products found for comparison');
    }

    const prices = products.map((p) => p.pricing.amount);
    const priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      currency: products[0].pricing.currency,
    };

    // Find common features
    const allFeatures = products.map((p) => p.features);
    const commonFeatures = allFeatures.reduce((common, features) => common.filter((feature) => features.includes(feature)));

    // Find unique features for each product
    const uniqueFeatures: Record<string, string[]> = {};
    products.forEach((product) => {
      uniqueFeatures[product.productId] = product.features.filter((feature) => !commonFeatures.includes(feature));
    });

    // Trial period comparison
    const trialComparison: Record<string, number | null> = {};
    products.forEach((product) => {
      trialComparison[product.productId] = product.billing.trial_period_days || null;
    });

    // Generate recommendations
    const recommendations: string[] = [];

    const cheapest = products.reduce((prev, current) => (prev.pricing.amount < current.pricing.amount ? prev : current));
    recommendations.push(`${cheapest.name} offers the best value at ${cheapest.pricing.amount} ${cheapest.pricing.currency}`);

    const mostFeatures = products.reduce((prev, current) => (prev.features.length > current.features.length ? prev : current));
    recommendations.push(`${mostFeatures.name} has the most features (${mostFeatures.features.length} features)`);

    const longestTrial = products.reduce((prev, current) => {
      const prevTrial = prev.billing.trial_period_days || 0;
      const currentTrial = current.billing.trial_period_days || 0;
      return prevTrial > currentTrial ? prev : current;
    });
    if (longestTrial.billing.trial_period_days) {
      recommendations.push(`${longestTrial.name} offers the longest trial period (${longestTrial.billing.trial_period_days} days)`);
    }

    return {
      products,
      comparison: {
        priceRange,
        commonFeatures,
        uniqueFeatures,
        trialComparison,
        recommendations,
      },
    };
  }

  /**
   * 產品搜尋建議 - New Enhanced Method
   */
  public async getSearchSuggestions(query: string): Promise<{
    productSuggestions: Product[];
    tagSuggestions: string[];
    categorySuggestions: string[];
  }> {
    const queryLower = query.toLowerCase();

    // Product suggestions based on name and description
    const productSuggestions = this.products
      .filter((product) => product.status === 'ACTIVE' && (product.name.toLowerCase().includes(queryLower) || product.description.toLowerCase().includes(queryLower)))
      .slice(0, 5);

    // Tag suggestions
    const allTags = this.products.flatMap((p) => p.metadata?.tags || []).filter((tag) => tag.toLowerCase().includes(queryLower));
    const tagSuggestions = [...new Set(allTags)].slice(0, 5);

    // Category suggestions
    const allCategories = this.products.map((p) => p.metadata?.category).filter((category) => category && category.toLowerCase().includes(queryLower));
    const categorySuggestions = [...new Set(allCategories)].slice(0, 5);

    return {
      productSuggestions,
      tagSuggestions,
      categorySuggestions,
    };
  }
}
