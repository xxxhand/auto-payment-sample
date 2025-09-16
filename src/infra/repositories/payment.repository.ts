import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { PaymentEntity } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/codes.const';
import { modelNames, IPaymentDocument } from '../models/models.definition';

@Injectable()
export class PaymentRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly mongoClient: CustomMongoClient) {}

  /**
   * 儲存支付記錄實體
   */
  public async save(entity: PaymentEntity): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    if (!entity) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);

    if (entity.isNew()) {
      // 新建支付記錄
      const doc: Omit<IPaymentDocument, '_id'> = {
        subscriptionId: new ObjectId(entity.subscriptionId),
        customerId: new ObjectId(entity.customerId),
        paymentMethodId: new ObjectId(entity.paymentMethodId),
        status: entity.status,
        amount: entity.amount,
        currency: entity.currency,
        description: entity.description,
        externalTransactionId: entity.externalTransactionId,
        billingPeriodStart: entity.billingPeriodStart,
        billingPeriodEnd: entity.billingPeriodEnd,
        attemptCount: entity.attemptCount,
        lastAttemptAt: entity.lastAttemptAt,
        paidAt: entity.paidAt,
        failedAt: entity.failedAt,
        failureReason: entity.failureReason,
        failureCode: entity.failureCode,
        refundedAt: entity.refundedAt,
        refundedAmount: entity.refundedAmount,
        refundReason: entity.refundReason,
        invoiceNumber: entity.invoiceNumber,
        receiptNumber: entity.receiptNumber,
        metadata: entity.metadata,
        providerPaymentId: entity.providerPaymentId,
        providerChargeId: entity.providerChargeId,
        failureDetails: entity.failureDetails
          ? {
              errorCode: entity.failureDetails.errorCode,
              errorMessage: entity.failureDetails.errorMessage,
              providerErrorCode: entity.failureDetails.providerErrorCode,
              providerErrorMessage: entity.failureDetails.providerErrorMessage,
              category: entity.failureDetails.category as any,
              isRetriable: entity.failureDetails.isRetriable,
              failedAt: entity.failureDetails.failedAt,
              metadata: entity.failureDetails.metadata,
            }
          : undefined,
        retryState: entity.retryState
          ? {
              attemptNumber: entity.retryState.attemptNumber,
              maxRetries: entity.retryState.maxRetries,
              nextRetryAt: entity.retryState.nextRetryAt,
              lastFailureReason: entity.retryState.lastFailureReason,
              failureCategory: entity.retryState.failureCategory as any,
              retryStrategy: entity.retryState.retryStrategy,
            }
          : undefined,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await collection.insertOne(doc as any);
      entity.id = result.insertedId.toHexString();
      return entity;
    } else {
      // 更新現有支付記錄
      const updateDoc = {
        $set: {
          subscriptionId: new ObjectId(entity.subscriptionId),
          customerId: new ObjectId(entity.customerId),
          paymentMethodId: new ObjectId(entity.paymentMethodId),
          status: entity.status,
          amount: entity.amount,
          currency: entity.currency,
          description: entity.description,
          externalTransactionId: entity.externalTransactionId,
          billingPeriodStart: entity.billingPeriodStart,
          billingPeriodEnd: entity.billingPeriodEnd,
          attemptCount: entity.attemptCount,
          lastAttemptAt: entity.lastAttemptAt,
          paidAt: entity.paidAt,
          failedAt: entity.failedAt,
          failureReason: entity.failureReason,
          failureCode: entity.failureCode,
          refundedAt: entity.refundedAt,
          refundedAmount: entity.refundedAmount,
          refundReason: entity.refundReason,
          invoiceNumber: entity.invoiceNumber,
          receiptNumber: entity.receiptNumber,
          metadata: entity.metadata,
          providerPaymentId: entity.providerPaymentId,
          providerChargeId: entity.providerChargeId,
          failureDetails: entity.failureDetails
            ? {
                errorCode: entity.failureDetails.errorCode,
                errorMessage: entity.failureDetails.errorMessage,
                providerErrorCode: entity.failureDetails.providerErrorCode,
                providerErrorMessage: entity.failureDetails.providerErrorMessage,
                category: entity.failureDetails.category as any,
                isRetriable: entity.failureDetails.isRetriable,
                failedAt: entity.failureDetails.failedAt,
                metadata: entity.failureDetails.metadata,
              }
            : undefined,
          retryState: entity.retryState
            ? {
                attemptNumber: entity.retryState.attemptNumber,
                maxRetries: entity.retryState.maxRetries,
                nextRetryAt: entity.retryState.nextRetryAt,
                lastFailureReason: entity.retryState.lastFailureReason,
                failureCategory: entity.retryState.failureCategory as any,
                retryStrategy: entity.retryState.retryStrategy,
              }
            : undefined,
          updatedAt: entity.updatedAt,
        },
      };

      await collection.updateOne({ _id: new ObjectId(entity.id) }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找支付記錄
   */
  public async findById(id: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    if (!CustomValidator.nonEmptyString(id)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const doc = (await collection.findOne({
      _id: new ObjectId(id),
    })) as IPaymentDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 根據訂閱 ID 查找支付記錄
   */
  public async findBySubscriptionId(subscriptionId: string): Promise<PaymentEntity[]> {
    if (!CustomValidator.nonEmptyString(subscriptionId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const docs = (await collection
      .find({ subscriptionId: new ObjectId(subscriptionId) })
      .sort({ createdAt: -1 })
      .toArray()) as IPaymentDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據客戶 ID 查找支付記錄
   */
  public async findByCustomerId(customerId: string, limit: number = 100): Promise<PaymentEntity[]> {
    if (!CustomValidator.nonEmptyString(customerId)) {
      return [];
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const docs = (await collection
      .find({ customerId: new ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as IPaymentDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找特定狀態的支付記錄
   */
  public async findByStatus(status: PaymentStatus, limit: number = 100): Promise<PaymentEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const docs = (await collection.find({ status }).limit(limit).toArray()) as IPaymentDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 查找失敗的支付記錄（可重試）
   */
  public async findFailedPayments(maxAttempts: number = 5): Promise<PaymentEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const docs = (await collection
      .find({
        status: PaymentStatus.FAILED,
        attemptCount: { $lt: maxAttempts },
      })
      .toArray()) as IPaymentDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 根據外部交易 ID 查找支付記錄
   */
  public async findByExternalTransactionId(externalId: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    if (!CustomValidator.nonEmptyString(externalId)) {
      return undefined;
    }

    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const doc = (await collection.findOne({ externalTransactionId: externalId })) as IPaymentDocument;

    if (!doc) {
      return undefined;
    }

    return this.documentToEntity(doc);
  }

  /**
   * 查找特定期間的支付記錄
   */
  public async findByDateRange(startDate: Date, endDate: Date, status?: PaymentStatus): Promise<PaymentEntity[]> {
    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const filter: any = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    if (status) {
      filter.status = status;
    }

    const docs = (await collection.find(filter).sort({ createdAt: -1 }).toArray()) as IPaymentDocument[];

    return docs.map((doc) => this.documentToEntity(doc));
  }

  /**
   * 計算支付統計
   */
  public async getPaymentStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalAmount: number;
    successCount: number;
    failureCount: number;
    refundedAmount: number;
  }> {
    const collection = this.mongoClient.getCollection(modelNames.PAYMENTS);
    const pipeline = [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.SUCCEEDED] }, '$amount', 0],
            },
          },
          successCount: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.SUCCEEDED] }, 1, 0],
            },
          },
          failureCount: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.FAILED] }, 1, 0],
            },
          },
          refundedAmount: {
            $sum: {
              $cond: [{ $ne: ['$refundedAmount', null] }, '$refundedAmount', 0],
            },
          },
        },
      },
    ];

    const result = await collection.aggregate(pipeline).toArray();
    const stats = result[0] as any;
    return stats || { totalAmount: 0, successCount: 0, failureCount: 0, refundedAmount: 0 };
  }

  /**
   * 將文檔轉換為實體
   */
  private documentToEntity(doc: IPaymentDocument): PaymentEntity {
    const entity = plainToInstance(PaymentEntity, {
      id: doc._id.toHexString(),
      subscriptionId: doc.subscriptionId.toHexString(),
      customerId: doc.customerId.toHexString(),
      paymentMethodId: doc.paymentMethodId.toHexString(),
      status: doc.status,
      amount: doc.amount,
      currency: doc.currency,
      description: doc.description,
      externalTransactionId: doc.externalTransactionId,
      billingPeriodStart: doc.billingPeriodStart,
      billingPeriodEnd: doc.billingPeriodEnd,
      attemptCount: doc.attemptCount,
      lastAttemptAt: doc.lastAttemptAt,
      paidAt: doc.paidAt,
      failedAt: doc.failedAt,
      failureReason: doc.failureReason,
      failureCode: doc.failureCode,
      refundedAt: doc.refundedAt,
      refundedAmount: doc.refundedAmount,
      refundReason: doc.refundReason,
      invoiceNumber: doc.invoiceNumber,
      receiptNumber: doc.receiptNumber,
      metadata: doc.metadata,
      providerPaymentId: doc.providerPaymentId,
      providerChargeId: doc.providerChargeId,
      failureDetails: doc.failureDetails
        ? {
            errorCode: doc.failureDetails.errorCode,
            errorMessage: doc.failureDetails.errorMessage,
            providerErrorCode: doc.failureDetails.providerErrorCode,
            providerErrorMessage: doc.failureDetails.providerErrorMessage,
            category: doc.failureDetails.category as any,
            isRetriable: doc.failureDetails.isRetriable,
            failedAt: doc.failureDetails.failedAt,
            metadata: doc.failureDetails.metadata,
          }
        : undefined,
      retryState: doc.retryState
        ? {
            attemptNumber: doc.retryState.attemptNumber,
            maxRetries: doc.retryState.maxRetries,
            nextRetryAt: doc.retryState.nextRetryAt,
            lastFailureReason: doc.retryState.lastFailureReason,
            failureCategory: doc.retryState.failureCategory as any,
            retryStrategy: doc.retryState.retryStrategy,
          }
        : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

    return entity;
  }
}
