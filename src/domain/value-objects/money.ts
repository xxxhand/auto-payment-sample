/**
 * 金額值物件
 * 封裝金額和貨幣的業務邏輯
 */
export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string = 'TWD') {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
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
   * 加法運算
   */
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /**
   * 減法運算
   */
  subtract(other: Money): Money {
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
    if (factor < 0) {
      throw new Error('Factor cannot be negative');
    }
    return new Money(Math.round(this._amount * factor), this._currency);
  }

  /**
   * 百分比計算
   */
  percentage(rate: number): Money {
    return this.multiply(rate / 100);
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
   * 格式化顯示
   */
  format(): string {
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
    };
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
   * 零金額
   */
  static zero(currency: string = 'TWD'): Money {
    return new Money(0, currency);
  }

  /**
   * 確保貨幣相同
   */
  private ensureSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} vs ${other._currency}`);
    }
  }
}
