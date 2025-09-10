/**
 * 金額值物件
 * 封裝金額和貨幣的業務邏輯
 */
export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string = 'TWD') {
    // 移除負數限制，支援退款等負數場景
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-character ISO code');
    }
    this._amount = Math.round(amount); // 以分為單位儲存
    this._currency = currency.toUpperCase();
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  /**
   * 取得以元為單位的金額
   */
  get amountInMajorUnit(): number {
    return this._amount / 100;
  }

  /**
   * 取得絕對值
   */
  get absoluteValue(): Money {
    return new Money(Math.abs(this._amount), this._currency);
  }

  /**
   * 加法運算
   */
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /**
   * 減法運算 - 允許負數結果
   */
  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  /**
   * 安全減法運算 - 不允許負數結果
   */
  safeSubtract(other: Money): Money {
    this.ensureSameCurrency(other);
    if (this._amount < other._amount) {
      throw new Error('Insufficient amount');
    }
    return new Money(this._amount - other._amount, this._currency);
  }

  /**
   * 乘法運算
   */
  multiply(factor: number): Money {
    return new Money(Math.round(this._amount * factor), this._currency);
  }

  /**
   * 除法運算
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new Money(Math.round(this._amount / divisor), this._currency);
  }

  /**
   * 百分比計算
   */
  percentage(rate: number): Money {
    return this.multiply(rate / 100);
  }

  /**
   * 稅務計算
   */
  calculateTax(taxRate: number): { taxAmount: Money; amountWithTax: Money; amountExcludingTax: Money } {
    const taxAmount = this.percentage(taxRate);
    return {
      taxAmount,
      amountWithTax: this.add(taxAmount),
      amountExcludingTax: this,
    };
  }

  /**
   * 從含稅金額計算稅額
   */
  calculateTaxFromGross(taxRate: number): { taxAmount: Money; amountExcludingTax: Money; amountWithTax: Money } {
    const divisor = 1 + taxRate / 100;
    const amountExcludingTax = this.divide(divisor);
    const taxAmount = this.subtract(amountExcludingTax);

    return {
      taxAmount,
      amountExcludingTax,
      amountWithTax: this,
    };
  }

  /**
   * 按比例分攤金額
   */
  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) {
      throw new Error('Ratios array cannot be empty');
    }

    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    if (totalRatio <= 0) {
      throw new Error('Total ratio must be positive');
    }

    const results: Money[] = [];
    let remainder = this._amount;

    for (let i = 0; i < ratios.length - 1; i++) {
      const allocated = Math.round((this._amount * ratios[i]) / totalRatio);
      results.push(new Money(allocated, this._currency));
      remainder -= allocated;
    }

    // 最後一份取剩餘金額，避免分攤誤差
    results.push(new Money(remainder, this._currency));
    return results;
  }

  /**
   * 平均分配金額
   */
  split(parts: number): Money[] {
    if (parts <= 0) {
      throw new Error('Parts must be positive');
    }

    const baseAmount = Math.floor(this._amount / parts);
    const remainder = this._amount % parts;

    const results: Money[] = [];

    for (let i = 0; i < parts; i++) {
      const amount = i < remainder ? baseAmount + 1 : baseAmount;
      results.push(new Money(amount, this._currency));
    }

    return results;
  }

  /**
   * 匯率轉換
   */
  convertTo(targetCurrency: string, exchangeRate: number): Money {
    if (exchangeRate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    const convertedAmount = Math.round(this._amount * exchangeRate);
    return new Money(convertedAmount, targetCurrency);
  }

  /**
   * 折扣計算
   */
  applyDiscount(discountRate: number): { discountAmount: Money; finalAmount: Money } {
    if (discountRate < 0 || discountRate > 100) {
      throw new Error('Discount rate must be between 0 and 100');
    }

    const discountAmount = this.percentage(discountRate);
    const finalAmount = this.subtract(discountAmount);

    return {
      discountAmount,
      finalAmount,
    };
  }

  /**
   * 固定金額折扣
   */
  applyFixedDiscount(discountAmount: Money): Money {
    this.ensureSameCurrency(discountAmount);
    return this.subtract(discountAmount);
  }

  /**
   * 比較是否相等
   */
  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }

  /**
   * 比較是否相等 (別名)
   */
  isEqual(other: Money): boolean {
    return this.equals(other);
  }

  /**
   * 比較大小
   */
  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount < other._amount;
  }

  isLessOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount <= other._amount;
  }

  isGreaterOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount >= other._amount;
  }

  /**
   * 檢查是否為零
   */
  isZero(): boolean {
    return this._amount === 0;
  }

  /**
   * 檢查是否為正數
   */
  isPositive(): boolean {
    return this._amount > 0;
  }

  /**
   * 檢查是否為負數
   */
  isNegative(): boolean {
    return this._amount < 0;
  }

  /**
   * 四捨五入到指定小數位數
   */
  round(decimalPlaces: number = 0): Money {
    const factor = Math.pow(10, decimalPlaces);
    const roundedAmount = Math.round(this._amount / factor) * factor;
    return new Money(roundedAmount, this._currency);
  }

  /**
   * 確保貨幣相同
   */
  private ensureSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error('Currency mismatch');
    }
  }

  /**
   * 創建負數金額 (用於退款等場景)
   */
  static negative(amount: number, currency: string = 'TWD'): Money {
    return new Money(-Math.abs(amount), currency);
  }

  /**
   * 計算多個金額的總和
   */
  static sum(...amounts: Money[]): Money {
    if (amounts.length === 0) {
      throw new Error('At least one amount is required');
    }

    return amounts.reduce((sum, current) => sum.add(current));
  }

  /**
   * 取得最小值
   */
  min(other: Money): Money {
    this.ensureSameCurrency(other);
    return this._amount <= other._amount ? this : other;
  }

  /**
   * 取得最大值
   */
  max(other: Money): Money {
    this.ensureSameCurrency(other);
    return this._amount >= other._amount ? this : other;
  }

  /**
   * 格式化顯示
   */
  format(locale: string = 'zh-TW'): string {
    const majorUnit = this.amountInMajorUnit;
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this._currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    return formatter.format(majorUnit);
  }

  /**
   * 格式化顯示
   */
  formatSimple(): string {
    const majorUnit = this.amountInMajorUnit;
    switch (this._currency) {
      case 'TWD':
        return `NT$ ${majorUnit.toLocaleString()}`;
      case 'USD':
        return `$ ${majorUnit.toLocaleString()}`;
      case 'EUR':
        return `€ ${majorUnit.toLocaleString()}`;
      default:
        return `${this._currency} ${majorUnit.toLocaleString()}`;
    }
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      amount: this._amount,
      currency: this._currency,
      amountInMajorUnit: this.amountInMajorUnit,
      isNegative: this.isNegative(),
      formatted: this.formatSimple(),
    };
  }

  /**
   * 序列化為字符串
   */
  toString(): string {
    return `${this._amount}${this._currency}`;
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): Money {
    return new Money(data.amount, data.currency);
  }

  /**
   * 從元為單位創建
   */
  static fromMajorUnit(amount: number, currency: string = 'TWD'): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  /**
   * 從字符串創建
   */
  static fromString(value: string): Money {
    const match = value.match(/^(-?\d+)([A-Z]{3})$/);
    if (!match) {
      throw new Error('Invalid money string format');
    }

    return new Money(parseInt(match[1]), match[2]);
  }

  /**
   * 零金額
   */
  static zero(currency: string = 'TWD'): Money {
    return new Money(0, currency);
  }

  /**
   * 比較多個金額的最小值
   */
  static min(...amounts: Money[]): Money {
    if (amounts.length === 0) {
      throw new Error('At least one amount is required');
    }

    return amounts.reduce((min, current) => min.min(current));
  }

  /**
   * 比較多個金額的最大值
   */
  static max(...amounts: Money[]): Money {
    if (amounts.length === 0) {
      throw new Error('At least one amount is required');
    }

    return amounts.reduce((max, current) => max.max(current));
  }
}
