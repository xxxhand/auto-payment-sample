export abstract class BaseEntity {
  public id: string = '';
  public createdAt: Date = new Date();
  public updatedAt: Date = new Date();

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
}
