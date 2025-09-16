import { DomainEvent } from '../events/domain-event';

export abstract class BaseEntity {
  public id: string = '';
  public createdAt: Date = new Date();
  public updatedAt: Date = new Date();

  // 領域事件暫存
  private _domainEvents: DomainEvent[] = [];

  /**
   * 更新時間戳記
   */
  public touch(): void {
    this.updatedAt = new Date();
  }

  /**
   * 檢查實體是否為新建立的（尚未儲存）
   */
  public isNew(): boolean {
    return !this.id || this.id.length === 0;
  }

  /**
   * 新增領域事件（供子類別呼叫）
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * 取得並清空當前累積的領域事件
   */
  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
