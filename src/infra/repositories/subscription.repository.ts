import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { SubscriptionEntity } from '../../domain/entities/subscription.entity';
import { SubscriptionStatus } from '../../domain/enums/codes.const';
import { modelNames, ISubscriptionDocument } from '../models/models.definition';

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly mongoClient: CustomMongoClient) {}

  /**
   * 儲存訂閱實體
   */
  public async save(entity: SubscriptionEntity): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    if (!entity) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);

    if (entity.isNew()) {
      // 新建訂閱
      const doc: Omit<ISubscriptionDocument, '_id'> = {
        customerId: new ObjectId(entity.customerId),
        paymentMethodId: new ObjectId(entity.paymentMethodId),
        planName: entity.planName,
        status: entity.status,
        billingCycle: entity.billingCycle,
        amount: entity.amount,
        currency: entity.currency,
        trialEndDate: entity.trialEndDate,
        currentPeriodStart: entity.currentPeriodStart,
        currentPeriodEnd: entity.currentPeriodEnd,
        nextBillingDate: entity.nextBillingDate,
        startDate: entity.startDate,
        endDate: entity.endDate,
        canceledDate: entity.canceledDate,
        cancelReason: entity.cancelReason,
        consecutiveFailures: entity.consecutiveFailures,
        lastSuccessfulBillingDate: entity.lastSuccessfulBillingDate,
        lastFailedBillingDate: entity.lastFailedBillingDate,
        gracePeriodEndDate: entity.gracePeriodEndDate,
        description: entity.description,
        metadata: entity.metadata,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await collection.insertOne(doc as any);
      entity.id = result.insertedId.toHexString();
      return entity;
    } else {
      // 更新現有訂閱
      const updateDoc = {
        $set: {
          customerId: new ObjectId(entity.customerId),
          paymentMethodId: new ObjectId(entity.paymentMethodId),
          planName: entity.planName,
          status: entity.status,
          billingCycle: entity.billingCycle,
          amount: entity.amount,
          currency: entity.currency,
          trialEndDate: entity.trialEndDate,
          currentPeriodStart: entity.currentPeriodStart,
          currentPeriodEnd: entity.currentPeriodEnd,
          nextBillingDate: entity.nextBillingDate,
          startDate: entity.startDate,
          endDate: entity.endDate,
          canceledDate: entity.canceledDate,
          cancelReason: entity.cancelReason,
          consecutiveFailures: entity.consecutiveFailures,
          lastSuccessfulBillingDate: entity.lastSuccessfulBillingDate,
          lastFailedBillingDate: entity.lastFailedBillingDate,
          gracePeriodEndDate: entity.gracePeriodEndDate,
          description: entity.description,
          metadata: entity.metadata,
          updatedAt: entity.updatedAt,
        },
      };

      await collection.updateOne({ _id: new ObjectId(entity.id) }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找訂閱
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const doc = (await collection.findOne({
      _id: new ObjectId(id),
    })) as ISubscriptionDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 根據客戶 ID 查找訂閱
   */
  public async findByCustomerId(customerId: string): Promise<SubscriptionEntity[]> {
    if (!CustomValidator.nonEmptyString(customerId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection.find({ customerId: new ObjectId(customerId) }).toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找需要計費的訂閱
   */
  public async findDueForBilling(startDate: Date, endDate: Date, limit: number = 100): Promise<SubscriptionEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection
      .find({
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .limit(limit)
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找逾期未付的訂閱
   */
  public async findPastDueSubscriptions(gracePeriodEndDate: Date): Promise<SubscriptionEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection
      .find({
        status: SubscriptionStatus.PAST_DUE,
        gracePeriodEndDate: { $lte: gracePeriodEndDate },
      })
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找在試用期的訂閱
   */
  public async findTrialSubscriptions(): Promise<SubscriptionEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection
      .find({
        status: SubscriptionStatus.TRIALING,
        trialEndDate: { $exists: true },
      })
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找即將到期的試用訂閱
   */
  public async findExpiringTrialSubscriptions(expiryDate: Date): Promise<SubscriptionEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection
      .find({
        status: SubscriptionStatus.TRIALING,
        trialEndDate: { $lte: expiryDate },
      })
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 統計訂閱數量
   */
  public async countSubscriptions(status?: SubscriptionStatus): Promise<number> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const filter = status ? { status } : {};
    return await collection.countDocuments(filter);
  }

  /**
   * 查找連續失敗次數超過閾值的訂閱
   */
  public async findSubscriptionsWithConsecutiveFailures(minFailures: number): Promise<SubscriptionEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection
      .find({
        consecutiveFailures: { $gte: minFailures },
        status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      })
      .toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據支付方式 ID 查找訂閱
   */
  public async findByPaymentMethodId(paymentMethodId: string): Promise<SubscriptionEntity[]> {
    if (!CustomValidator.nonEmptyString(paymentMethodId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.SUBSCRIPTIONS);
    const docs = (await collection.find({ paymentMethodId: new ObjectId(paymentMethodId) }).toArray()) as ISubscriptionDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 將文檔轉換為實體
   */
  private documentToEntity(doc: ISubscriptionDocument): SubscriptionEntity {
    const entity = plainToInstance(SubscriptionEntity, {
      id: doc._id.toHexString(),
      customerId: doc.customerId.toHexString(),
      paymentMethodId: doc.paymentMethodId.toHexString(),
      planName: doc.planName,
      status: doc.status,
      billingCycle: doc.billingCycle,
      amount: doc.amount,
      currency: doc.currency,
      trialEndDate: doc.trialEndDate,
      currentPeriodStart: doc.currentPeriodStart,
      currentPeriodEnd: doc.currentPeriodEnd,
      nextBillingDate: doc.nextBillingDate,
      startDate: doc.startDate,
      endDate: doc.endDate,
      canceledDate: doc.canceledDate,
      cancelReason: doc.cancelReason,
      consecutiveFailures: doc.consecutiveFailures,
      lastSuccessfulBillingDate: doc.lastSuccessfulBillingDate,
      lastFailedBillingDate: doc.lastFailedBillingDate,
      gracePeriodEndDate: doc.gracePeriodEndDate,
      description: doc.description,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

    return entity;
  }
}
