import { Injectable } from '@nestjs/common';
import { ProductEntity } from '../../domain/entities/product.entity';
import { ProductModel, IProductDocument } from '../models/product.model';
import { Money } from '../../domain/value-objects/money';
import { BillingCycleVO } from '../../domain/value-objects/billing-cycle';
import { ProductStatus, ProductType } from '../../domain/enums/codes.const';

@Injectable()
export class ProductRepository {
  /**
   * 保存產品實體
   */
  async save(entity: ProductEntity): Promise<ProductEntity> {
    if (!entity.id) {
      // 新建產品
      const doc = {
        productId: entity.productId,
        name: entity.name,
        description: entity.description,
        status: entity.status,
        type: entity.type,
        pricingTiers: entity.pricingTiers.map((tier) => ({
          tierId: tier.tierId,
          name: tier.name,
          basePrice: {
            amount: tier.basePrice.amount,
            currency: tier.basePrice.currency,
          },
          billingCycle: {
            type: tier.billingCycle.type,
            intervalDays: tier.billingCycle.intervalDays,
            billingDay: tier.billingCycle.billingDay,
          },
          features: tier.features,
          limits: tier.limits,
          isRecommended: tier.isRecommended,
          sortOrder: tier.sortOrder,
        })),
        features: entity.features,
        metadata: entity.metadata,
        imageUrls: entity.imageUrls,
        documentationUrls: entity.documentationUrls,
        launchDate: entity.launchDate,
        retirementDate: entity.retirementDate,
        version: entity.version,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await ProductModel.create(doc);
      entity.id = result._id.toString();
      return entity;
    } else {
      // 更新現有產品
      const updateDoc = {
        $set: {
          name: entity.name,
          description: entity.description,
          status: entity.status,
          type: entity.type,
          pricingTiers: entity.pricingTiers.map((tier) => ({
            tierId: tier.tierId,
            name: tier.name,
            basePrice: {
              amount: tier.basePrice.amount,
              currency: tier.basePrice.currency,
            },
            billingCycle: {
              type: tier.billingCycle.type,
              intervalDays: tier.billingCycle.intervalDays,
              billingDay: tier.billingCycle.billingDay,
            },
            features: tier.features,
            limits: tier.limits,
            isRecommended: tier.isRecommended,
            sortOrder: tier.sortOrder,
          })),
          features: entity.features,
          metadata: entity.metadata,
          imageUrls: entity.imageUrls,
          documentationUrls: entity.documentationUrls,
          launchDate: entity.launchDate,
          retirementDate: entity.retirementDate,
          version: entity.version,
          updatedAt: entity.updatedAt,
        },
      };

      await ProductModel.updateOne({ _id: entity.id }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找產品
   */
  async findById(id: string): Promise<ProductEntity | null> {
    const doc = await ProductModel.findById(id);
    return doc ? this.mapToEntity(doc) : null;
  }

  /**
   * 根據產品 ID 查找產品
   */
  async findByProductId(productId: string): Promise<ProductEntity | null> {
    const doc = await ProductModel.findOne({ productId });
    return doc ? this.mapToEntity(doc) : null;
  }

  /**
   * 查找所有活躍產品
   */
  async findActiveProducts(): Promise<ProductEntity[]> {
    const docs = await ProductModel.find({
      status: ProductStatus.ACTIVE,
      $or: [{ retirementDate: { $exists: false } }, { retirementDate: { $gt: new Date() } }],
    });

    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 根據類型查找產品
   */
  async findByType(type: ProductType): Promise<ProductEntity[]> {
    const docs = await ProductModel.find({ type });
    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 根據分類查找產品
   */
  async findByCategory(category: string): Promise<ProductEntity[]> {
    const docs = await ProductModel.find({ 'metadata.category': category });
    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 根據地區查找支援的產品
   */
  async findByRegion(region: string): Promise<ProductEntity[]> {
    const docs = await ProductModel.find({
      'metadata.supportedRegions': region,
      status: ProductStatus.ACTIVE,
    });
    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 刪除產品
   */
  async delete(id: string): Promise<void> {
    await ProductModel.deleteOne({ _id: id });
  }

  /**
   * 將文檔對象映射為實體
   */
  private mapToEntity(doc: IProductDocument): ProductEntity {
    const entity = new ProductEntity(doc.name, doc.description, doc.type);

    entity.id = doc._id.toString();
    entity.productId = doc.productId;
    entity.status = doc.status;
    entity.version = doc.version;
    entity.createdAt = doc.createdAt;
    entity.updatedAt = doc.updatedAt;
    entity.launchDate = doc.launchDate;
    entity.retirementDate = doc.retirementDate;
    entity.imageUrls = doc.imageUrls;
    entity.documentationUrls = doc.documentationUrls;
    entity.metadata = doc.metadata;

    // 映射定價層級
    entity.pricingTiers = doc.pricingTiers.map((tier) => ({
      tierId: tier.tierId,
      name: tier.name,
      basePrice: new Money(tier.basePrice.amount, tier.basePrice.currency),
      billingCycle: new BillingCycleVO(tier.billingCycle.type as any, tier.billingCycle.intervalDays, tier.billingCycle.billingDay),
      features: tier.features,
      limits: tier.limits,
      isRecommended: tier.isRecommended,
      sortOrder: tier.sortOrder,
    }));

    // 映射產品功能
    entity.features = doc.features;

    return entity;
  }
}
