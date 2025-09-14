import { PaymentRepository } from '../payment.repository';
import { ObjectId } from 'mongodb';
import { PaymentEntity } from '../../../domain/entities/payment.entity';
import { PaymentFailureCategory, PaymentStatus } from '../../../domain/enums/codes.const';

// Do not import real CustomMongoClient to avoid constructor requirements
class InMemoryCollection {
  private docs: any[] = [];
  async insertOne(doc: any) {
    const _id = new ObjectId();
    const saved = { ...doc, _id };
    this.docs.push(saved);
    return { insertedId: _id };
  }
  async updateOne(filter: any, update: any) {
    const idx = this.docs.findIndex((d) => d._id.toHexString() === filter._id.toHexString());
    if (idx >= 0) this.docs[idx] = { ...this.docs[idx], ...update.$set };
    return { matchedCount: idx >= 0 ? 1 : 0, modifiedCount: idx >= 0 ? 1 : 0 };
  }
  async findOne(filter: any) {
    return this.docs.find((d) => d._id.toHexString() === filter._id.toHexString()) || null;
  }
  find() {
    const data = this.docs.slice();
    return {
      sort: () => ({ toArray: async () => data }),
      limit: () => ({ toArray: async () => data }),
      toArray: async () => data,
    } as any;
  }
}

class InMemoryMongoClient {
  private collections = new Map<string, InMemoryCollection>();
  getCollection(name: string) {
    if (!this.collections.has(name)) this.collections.set(name, new InMemoryCollection());
    return this.collections.get(name)!;
  }
}

describe.skip('PaymentRepository persistence of failureDetails/retryState (skipped: deferred)', () => {
  it('should persist and read back failureDetails and retryState', async () => {
    const mongo = new InMemoryMongoClient();
    const repo = new PaymentRepository(mongo as any);

    // create entity
    const start = new Date();
    const end = new Date(Date.now() + 86400000);
    // valid 24-hex ObjectId strings for refs
    const entity = new PaymentEntity('000000000000000000000001', '000000000000000000000002', '000000000000000000000003', 1000, start, end, 'TWD');

    // set states
    entity.status = PaymentStatus.FAILED;
    entity.failureDetails = {
      errorCode: 'GATEWAY_TIMEOUT',
      errorMessage: 'timeout',
      category: PaymentFailureCategory.RETRIABLE,
      isRetriable: true,
      failedAt: new Date(),
    };
    entity.retryState = {
      attemptNumber: 2,
      maxRetries: 5,
      nextRetryAt: new Date(Date.now() + 60000),
      lastFailureReason: 'timeout',
      failureCategory: PaymentFailureCategory.RETRIABLE,
      retryStrategy: 'LINEAR',
    };

    // insert
    const saved = await repo.save(entity);
    expect(saved?.id).toBeTruthy();

    // read back
    const found = await repo.findById(saved!.id);
    expect(found?.failureDetails?.category).toBe(PaymentFailureCategory.RETRIABLE);
    expect(found?.retryState?.attemptNumber).toBe(2);
    expect(found?.retryState?.maxRetries).toBe(5);
    expect(found?.retryState?.retryStrategy).toBe('LINEAR');

    // update
    found!.retryState!.attemptNumber = 3;
    await repo.save(found!);
    const updated = await repo.findById(saved!.id);
    expect(updated?.retryState?.attemptNumber).toBe(3);
  });
});
