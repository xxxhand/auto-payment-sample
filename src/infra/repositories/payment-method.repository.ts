import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PaymentMethodEntity } from '../../domain/entities/payment-method.entity';
import { PaymentMethodStatus } from '../../domain/enums/codes.const';
import { modelNames, IPaymentMethodDocument } from '../models/models.definition';

@Injectable()
export class PaymentMethodRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly mongoClient: CustomMongoClient) {}

  /**
   * 儲存支付方式實體
   */
  public async save(entity: PaymentMethodEntity): Promise<CustomDefinition.TNullable<PaymentMethodEntity>> {
    if (!entity) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);

    if (entity.isNew()) {
      // 新建支付方式
      const doc: Omit<IPaymentMethodDocument, '_id'> = {
        customerId: new ObjectId(entity.customerId),
        type: entity.type,
        name: entity.name,
        status: entity.status,
        externalId: entity.externalId,
        maskedInfo: entity.maskedInfo,
        expiryDate: entity.expiryDate,
        isDefault: entity.isDefault,
        metadata: entity.metadata,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await collection.insertOne(doc as any);
      entity.id = result.insertedId.toHexString();
      return entity;
    } else {
      // 更新現有支付方式
      const updateDoc = {
        $set: {
          customerId: new ObjectId(entity.customerId),
          type: entity.type,
          name: entity.name,
          status: entity.status,
          externalId: entity.externalId,
          maskedInfo: entity.maskedInfo,
          expiryDate: entity.expiryDate,
          isDefault: entity.isDefault,
          metadata: entity.metadata,
          updatedAt: entity.updatedAt,
        },
      };

      await collection.updateOne({ _id: new ObjectId(entity.id) }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找支付方式
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<PaymentMethodEntity>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);
    const doc = (await collection.findOne({
      _id: new ObjectId(id),
    })) as IPaymentMethodDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 根據客戶 ID 查找支付方式
   */
  public async findByCustomerId(customerId: string): Promise<PaymentMethodEntity[]> {
    if (!CustomValidator.nonEmptyString(customerId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);
    const docs = (await collection
      .find({ customerId: new ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .toArray()) as IPaymentMethodDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據狀態查找支付方式
   */
  public async findByStatus(status: PaymentMethodStatus): Promise<PaymentMethodEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);
    const docs = (await collection.find({ status }).toArray()) as IPaymentMethodDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據客戶 ID 和狀態查找支付方式
   */
  public async findByCustomerIdAndStatus(customerId: string, status: PaymentMethodStatus): Promise<PaymentMethodEntity[]> {
    if (!CustomValidator.nonEmptyString(customerId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);
    const docs = (await collection
      .find({ 
        customerId: new ObjectId(customerId),
        status 
      })
      .sort({ createdAt: -1 })
      .toArray()) as IPaymentMethodDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找客戶的預設支付方式
   */
  public async findDefaultByCustomerId(customerId: string): Promise<CustomDefinition.TNullable<PaymentMethodEntity>> {
    if (!CustomValidator.nonEmptyString(customerId)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENT_METHODS);
    const doc = (await collection.findOne({
      customerId: new ObjectId(customerId),
      isDefault: true,
      status: PaymentMethodStatus.ACTIVE,
    })) as IPaymentMethodDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 將文檔轉換為實體
   */
  private documentToEntity(doc: IPaymentMethodDocument): PaymentMethodEntity {
    const entity = plainToInstance(PaymentMethodEntity, {
      id: doc._id.toHexString(),
      customerId: doc.customerId.toHexString(),
      type: doc.type,
      name: doc.name,
      status: doc.status,
      externalId: doc.externalId,
      maskedInfo: doc.maskedInfo,
      expiryDate: doc.expiryDate,
      isDefault: doc.isDefault,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

    return entity;
  }
}