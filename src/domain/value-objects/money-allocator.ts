import { Money } from './money';

/**
 * 金額分配結果
 */
export interface AllocationResult {
  /** 分配的金額列表 */
  allocations: Money[];
  /** 分配前的總金額 */
  originalAmount: Money;
  /** 分配後的總金額 */
  totalAllocated: Money;
  /** 分配誤差（由於四捨五入造成） */
  roundingError: Money;
  /** 分配比例 */
  ratios: number[];
}

/**
 * 分攤規則
 */
export interface AllocationRule {
  /** 分攤標識 */
  id: string;
  /** 分攤名稱 */
  name: string;
  /** 分攤比例或固定金額 */
  allocation: number | Money;
  /** 分攤類型 */
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'RATIO';
  /** 最小金額限制 */
  minAmount?: Money;
  /** 最大金額限制 */
  maxAmount?: Money;
  /** 是否為必要分攤（不能為0） */
  required: boolean;
}

/**
 * 金額分配器值物件
 * 處理複雜的金額分配、分攤和比例計算
 */
export class MoneyAllocatorVO {
  private readonly _originalAmount: Money;
  private readonly _precision: number;

  constructor(originalAmount: Money, precision: number = 2) {
    this._originalAmount = originalAmount;
    this._precision = Math.max(0, Math.min(10, precision)); // 限制精度在0-10之間
  }

  get originalAmount(): Money {
    return this._originalAmount;
  }

  get precision(): number {
    return this._precision;
  }

  /**
   * 按比例分配金額
   */
  allocateByRatios(ratios: number[]): AllocationResult {
    if (ratios.length === 0) {
      throw new Error('Ratios array cannot be empty');
    }

    if (ratios.some((ratio) => ratio < 0)) {
      throw new Error('Ratios cannot be negative');
    }

    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    if (totalRatio === 0) {
      throw new Error('Total ratio cannot be zero');
    }

    const allocations: Money[] = [];
    let remainingAmount = this._originalAmount.amount;

    // 計算前n-1個分配
    for (let i = 0; i < ratios.length - 1; i++) {
      const allocatedAmount = Math.round((this._originalAmount.amount * ratios[i]) / totalRatio);
      allocations.push(new Money(allocatedAmount, this._originalAmount.currency));
      remainingAmount -= allocatedAmount;
    }

    // 最後一個分配取剩餘金額，確保總和正確
    allocations.push(new Money(remainingAmount, this._originalAmount.currency));

    return this.createAllocationResult(allocations, ratios);
  }

  /**
   * 按百分比分配金額
   */
  allocateByPercentages(percentages: number[]): AllocationResult {
    if (percentages.some((p) => p < 0 || p > 100)) {
      throw new Error('Percentages must be between 0 and 100');
    }

    const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Percentages must sum to 100%');
    }

    // 轉換為比例
    const ratios = percentages.map((p) => p / 100);
    return this.allocateByRatios(ratios);
  }

  /**
   * 平均分配金額
   */
  allocateEvenly(parts: number): AllocationResult {
    if (parts <= 0) {
      throw new Error('Parts must be positive');
    }

    const ratios = new Array(parts).fill(1);
    return this.allocateByRatios(ratios);
  }

  /**
   * 按規則分配金額
   */
  allocateByRules(rules: AllocationRule[]): AllocationResult & { ruleResults: Array<{ rule: AllocationRule; amount: Money }> } {
    if (rules.length === 0) {
      throw new Error('Rules array cannot be empty');
    }

    let remainingAmount = this._originalAmount;
    const ruleResults: Array<{ rule: AllocationRule; amount: Money }> = [];
    const allocations: Money[] = [];

    // 第一階段：處理固定金額分配
    const fixedRules = rules.filter((rule) => rule.type === 'FIXED_AMOUNT');
    for (const rule of fixedRules) {
      const fixedAmount = rule.allocation as Money;

      if (!fixedAmount.currency || fixedAmount.currency !== this._originalAmount.currency) {
        throw new Error(`Currency mismatch in rule ${rule.id}`);
      }

      if (fixedAmount.isGreaterThan(remainingAmount)) {
        if (rule.required) {
          throw new Error(`Insufficient amount for required rule ${rule.id}`);
        }
        // 非必要規則，分配剩餘金額
        const allocatedAmount = remainingAmount;
        ruleResults.push({ rule, amount: allocatedAmount });
        allocations.push(allocatedAmount);
        remainingAmount = Money.zero(this._originalAmount.currency);
      } else {
        ruleResults.push({ rule, amount: fixedAmount });
        allocations.push(fixedAmount);
        remainingAmount = remainingAmount.subtract(fixedAmount);
      }
    }

    // 第二階段：處理百分比和比例分配
    const proportionalRules = rules.filter((rule) => rule.type === 'PERCENTAGE' || rule.type === 'RATIO');

    if (proportionalRules.length > 0 && remainingAmount.isPositive()) {
      const ratios: number[] = [];

      for (const rule of proportionalRules) {
        if (rule.type === 'PERCENTAGE') {
          ratios.push((rule.allocation as number) / 100);
        } else {
          ratios.push(rule.allocation as number);
        }
      }

      const proportionalResult = new MoneyAllocatorVO(remainingAmount).allocateByRatios(ratios);

      for (let i = 0; i < proportionalRules.length; i++) {
        const rule = proportionalRules[i];
        let allocatedAmount = proportionalResult.allocations[i];

        // 應用最小/最大限制
        if (rule.minAmount && allocatedAmount.isLessThan(rule.minAmount)) {
          allocatedAmount = rule.minAmount;
        }
        if (rule.maxAmount && allocatedAmount.isGreaterThan(rule.maxAmount)) {
          allocatedAmount = rule.maxAmount;
        }

        ruleResults.push({ rule, amount: allocatedAmount });
        allocations.push(allocatedAmount);
      }
    }

    const result = this.createAllocationResult(allocations, []);

    return {
      ...result,
      ruleResults,
    };
  }

  /**
   * 計算稅務分配
   */
  allocateTaxes(taxRates: Array<{ name: string; rate: number }>): {
    netAmount: Money;
    taxes: Array<{ name: string; rate: number; amount: Money }>;
    totalTax: Money;
    grossAmount: Money;
  } {
    const taxes = taxRates.map((tax) => ({
      name: tax.name,
      rate: tax.rate,
      amount: this._originalAmount.percentage(tax.rate),
    }));

    const totalTax = Money.sum(...taxes.map((tax) => tax.amount));
    const netAmount = this._originalAmount.subtract(totalTax);

    return {
      netAmount,
      taxes,
      totalTax,
      grossAmount: this._originalAmount,
    };
  }

  /**
   * 計算服務費分配
   */
  allocateServiceFees(
    serviceFeeRate: number,
    platformFeeRate: number = 0,
    processingFeeFixed: Money = Money.zero(this._originalAmount.currency),
  ): {
    merchantAmount: Money;
    serviceFee: Money;
    platformFee: Money;
    processingFee: Money;
    totalFees: Money;
    originalAmount: Money;
  } {
    const serviceFee = this._originalAmount.percentage(serviceFeeRate);
    const platformFee = this._originalAmount.percentage(platformFeeRate);
    const processingFee = processingFeeFixed;

    const totalFees = Money.sum(serviceFee, platformFee, processingFee);
    const merchantAmount = this._originalAmount.subtract(totalFees);

    return {
      merchantAmount,
      serviceFee,
      platformFee,
      processingFee,
      totalFees,
      originalAmount: this._originalAmount,
    };
  }

  /**
   * 分級計費分配
   */
  allocateByTiers(tiers: Array<{ threshold: Money; rate: number }>): {
    tierResults: Array<{ tier: number; threshold: Money; rate: number; amount: Money; fee: Money }>;
    totalFees: Money;
    remainingAmount: Money;
  } {
    // 按閾值排序
    const sortedTiers = [...tiers].sort((a, b) => a.threshold.amount - b.threshold.amount);

    let remainingAmount = this._originalAmount;
    const tierResults: Array<{ tier: number; threshold: Money; rate: number; amount: Money; fee: Money }> = [];
    let totalFees = Money.zero(this._originalAmount.currency);

    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];
      const tierAmount = tier.threshold.min(remainingAmount);

      if (tierAmount.isPositive()) {
        const fee = tierAmount.percentage(tier.rate);

        tierResults.push({
          tier: i + 1,
          threshold: tier.threshold,
          rate: tier.rate,
          amount: tierAmount,
          fee,
        });

        totalFees = totalFees.add(fee);
        remainingAmount = remainingAmount.subtract(tierAmount);
      }

      if (remainingAmount.isZero()) {
        break;
      }
    }

    return {
      tierResults,
      totalFees,
      remainingAmount,
    };
  }

  /**
   * 驗證分配結果
   */
  validateAllocation(allocations: Money[]): {
    isValid: boolean;
    totalAllocated: Money;
    difference: Money;
    errors: string[];
  } {
    const errors: string[] = [];

    // 檢查貨幣一致性
    const currencies = new Set(allocations.map((a) => a.currency));
    if (currencies.size > 1) {
      errors.push('All allocations must have the same currency');
    }

    if (!currencies.has(this._originalAmount.currency)) {
      errors.push('Allocation currency does not match original amount currency');
    }

    // 計算總和
    const totalAllocated = Money.sum(...allocations);
    const difference = totalAllocated.subtract(this._originalAmount);

    // 檢查總和是否匹配（允許小的四捨五入誤差）
    if (Math.abs(difference.amount) > allocations.length) {
      errors.push(`Total allocation (${totalAllocated.formatSimple()}) does not match original amount (${this._originalAmount.formatSimple()})`);
    }

    return {
      isValid: errors.length === 0,
      totalAllocated,
      difference,
      errors,
    };
  }

  /**
   * 創建分配結果
   */
  private createAllocationResult(allocations: Money[], ratios: number[]): AllocationResult {
    const totalAllocated = Money.sum(...allocations);
    const roundingError = totalAllocated.subtract(this._originalAmount);

    return {
      allocations,
      originalAmount: this._originalAmount,
      totalAllocated,
      roundingError,
      ratios,
    };
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      originalAmount: this._originalAmount.toJSON(),
      precision: this._precision,
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): MoneyAllocatorVO {
    return new MoneyAllocatorVO(Money.fromJSON(data.originalAmount), data.precision);
  }
}
