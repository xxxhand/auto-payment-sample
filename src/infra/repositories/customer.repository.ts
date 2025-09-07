import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { CustomerEntity } from '../../domain/entities/customer.entity';
import { modelNames, ICustomerDocument } from '../models/models.definition';

@Injectable()
export class CustomerRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly mongoClient: CustomMongoClient) {}

  /**
   * 儲存客戶實體
   */
  public async save(entity: CustomerEntity): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    if (!entity) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);

    if (entity.isNew()) {
      // 新建客戶
      const doc: Omit<ICustomerDocument, '_id'> = {
        name: entity.name,
        email: entity.email,
        phone: entity.phone,
        status: entity.status,
        defaultPaymentMethodId: entity.defaultPaymentMethodId ? new ObjectId(entity.defaultPaymentMethodId) : null,
        notes: entity.notes,
        tags: entity.tags,
        locale: entity.locale,
        timezone: entity.timezone,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await collection.insertOne(doc as any);
      entity.id = result.insertedId.toHexString();
      return entity;
    } else {
      // 更新現有客戶
      const updateDoc = {
        $set: {
          name: entity.name,
          email: entity.email,
          phone: entity.phone,
          status: entity.status,
          defaultPaymentMethodId: entity.defaultPaymentMethodId ? new ObjectId(entity.defaultPaymentMethodId) : null,
          notes: entity.notes,
          tags: entity.tags,
          locale: entity.locale,
          timezone: entity.timezone,
          updatedAt: entity.updatedAt,
        },
      };

      await collection.updateOne({ _id: new ObjectId(entity.id) }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找客戶
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const doc = (await collection.findOne({
      _id: new ObjectId(id),
    })) as ICustomerDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 根據 Email 查找客戶
   */
  public async findByEmail(email: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    if (!CustomValidator.nonEmptyString(email)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const doc = (await collection.findOne({ email })) as ICustomerDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 查找活躍客戶
   */
  public async findActiveCustomers(limit: number = 100, offset: number = 0): Promise<CustomerEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const docs = (await collection.find({ status: 'ACTIVE' }).skip(offset).limit(limit).toArray()) as ICustomerDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據標籤查找客戶
   */
  public async findByTags(tags: string[], limit: number = 100): Promise<CustomerEntity[]> {
    if (!tags || tags.length === 0) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const docs = (await collection
      .find({ tags: { $in: tags } })
      .limit(limit)
      .toArray()) as ICustomerDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 統計客戶數量
   */
  public async countCustomers(status?: string): Promise<number> {
    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const filter = status ? { status } : {};
    return await collection.countDocuments(filter);
  }

  /**
   * 軟刪除客戶（標記為已刪除）
   */
  public async softDelete(id: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(id)) {
      return false;
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'DELETED',
          updatedAt: new Date(),
        },
      },
    );

    return result.modifiedCount > 0;
  }

  /**
   * 檢查 Email 是否已存在
   */
  public async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    if (!CustomValidator.nonEmptyString(email)) {
      return false;
    }

    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const filter: any = { email };

    if (excludeId) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }

    const count = await collection.countDocuments(filter);
    return count > 0;
  }

  /**
   * 根據狀態查找客戶
   */
  public async findByStatus(status: string, limit: number = 100): Promise<CustomerEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const filter = { status };

    const cursor = collection.find(filter).limit(limit);
    const docs = await cursor.toArray();

    return docs.map((doc) => this.documentToEntity(doc as ICustomerDocument));
  }

  /**
   * 進階客戶搜尋
   */
  public async searchCustomers(
    criteria: {
      name?: string;
      email?: string;
      phone?: string;
      status?: string;
      tags?: string[];
      createdAfter?: Date;
      createdBefore?: Date;
      locale?: string;
      timezone?: string;
      hasDefaultPaymentMethod?: boolean;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<CustomerEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const filter: any = {};

    // 建立查詢條件
    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' };
    }
    if (criteria.email) {
      filter.email = { $regex: criteria.email, $options: 'i' };
    }
    if (criteria.phone) {
      filter.phone = { $regex: criteria.phone, $options: 'i' };
    }
    if (criteria.status) {
      filter.status = criteria.status;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      filter.tags = { $in: criteria.tags };
    }
    if (criteria.createdAfter) {
      filter.createdAt = { ...filter.createdAt, $gte: criteria.createdAfter };
    }
    if (criteria.createdBefore) {
      filter.createdAt = { ...filter.createdAt, $lte: criteria.createdBefore };
    }
    if (criteria.locale) {
      filter.locale = criteria.locale;
    }
    if (criteria.timezone) {
      filter.timezone = criteria.timezone;
    }
    if (typeof criteria.hasDefaultPaymentMethod === 'boolean') {
      if (criteria.hasDefaultPaymentMethod) {
        filter.defaultPaymentMethodId = { $ne: null };
      } else {
        filter.defaultPaymentMethodId = null;
      }
    }

    const cursor = collection.find(filter).skip(offset).limit(limit);
    const docs = await cursor.toArray();

    return docs.map((doc) => this.documentToEntity(doc as ICustomerDocument));
  }

  /**
   * 計算搜尋結果數量
   */
  public async countSearchResults(criteria: {
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    tags?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    locale?: string;
    timezone?: string;
    hasDefaultPaymentMethod?: boolean;
  }): Promise<number> {
    const collection = this.mongoClient.getCollection(modelNames.CUSTOMERS);
    const filter: any = {};

    // 建立查詢條件（與 searchCustomers 相同）
    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' };
    }
    if (criteria.email) {
      filter.email = { $regex: criteria.email, $options: 'i' };
    }
    if (criteria.phone) {
      filter.phone = { $regex: criteria.phone, $options: 'i' };
    }
    if (criteria.status) {
      filter.status = criteria.status;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      filter.tags = { $in: criteria.tags };
    }
    if (criteria.createdAfter) {
      filter.createdAt = { ...filter.createdAt, $gte: criteria.createdAfter };
    }
    if (criteria.createdBefore) {
      filter.createdAt = { ...filter.createdAt, $lte: criteria.createdBefore };
    }
    if (criteria.locale) {
      filter.locale = criteria.locale;
    }
    if (criteria.timezone) {
      filter.timezone = criteria.timezone;
    }
    if (typeof criteria.hasDefaultPaymentMethod === 'boolean') {
      if (criteria.hasDefaultPaymentMethod) {
        filter.defaultPaymentMethodId = { $ne: null };
      } else {
        filter.defaultPaymentMethodId = null;
      }
    }

    return await collection.countDocuments(filter);
  }

  /**
   * 將文檔轉換為實體
   */
  private documentToEntity(doc: ICustomerDocument): CustomerEntity {
    const entity = plainToInstance(CustomerEntity, {
      id: doc._id.toHexString(),
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      status: doc.status,
      defaultPaymentMethodId: doc.defaultPaymentMethodId ? doc.defaultPaymentMethodId.toHexString() : null,
      notes: doc.notes,
      tags: doc.tags,
      locale: doc.locale,
      timezone: doc.timezone,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

    return entity;
  }
}
