import * as superTest from 'supertest';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, InjectionToken } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { runInitial } from '../../src/app-components/app.initial';
// import { DEFAULT_MONGO } from '@myapp/common';

// Set environment variables at startup
// process.env.NODE_ENV = 'test';
// process.env.DEFAULT_MONGO_URI = 'mongodb://localhost:27017';
// process.env.DEFAULT_MONGO_DB_NAME = 'payment_test';
// process.env.DEFAULT_MONGO_MIN_POOL = '1';
// process.env.DEFAULT_MONGO_MAX_POOL = '5';
// process.env.DEFAULT_MONGO_CONN_TIMEOUT = '5000';
// process.env.API_PREFIX = '/client_service/api';
// process.env.LOG_FILE_PATH = './logs/combined.log';

// 創建一個模擬的MongoDB客戶端
// const mockMongoClient = {
//   dbConn: {
//     collection: jest.fn().mockReturnValue({
//       find: jest.fn().mockReturnValue({
//         toArray: jest.fn().mockResolvedValue([]),
//       }),
//       findOne: jest.fn().mockResolvedValue(null),
//       insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
//       updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
//       deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
//       countDocuments: jest.fn().mockResolvedValue(0),
//     }),
//   },
//   tryConnect: jest.fn().mockResolvedValue(true),
//   close: jest.fn().mockResolvedValue(true),
// };

export class AppHelper {
  private static _app?: INestApplication = undefined;
  private static _agent?: superTest.SuperAgentTest = undefined;

  public static async getAgent(): Promise<superTest.SuperAgentTest> {
    if (!this._agent) {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        // .overrideProvider(DEFAULT_MONGO)
        // .useValue(mockMongoClient)
        .compile();

      this._app = moduleFixture.createNestApplication();
      runInitial(this._app);
      await this._app.init();
      this._agent = superTest.agent(this._app.getHttpServer());
    }
    return this._agent;
  }

  public static async getAgentWithMockers(mockers: Map<InjectionToken, any>): Promise<superTest.SuperAgentTest> {
    if (!this._agent) {
      const builder: TestingModuleBuilder = await Test.createTestingModule({
        imports: [AppModule],
      });

      // // 添加MongoDB模擬
      // builder.overrideProvider(DEFAULT_MONGO).useValue(mockMongoClient);

      if (mockers.size > 0) {
        mockers.forEach((v, k) => {
          builder.overrideProvider(k).useValue(v);
        });
      }
      const mod = await builder.compile();
      this._app = mod.createNestApplication();
      runInitial(this._app);
      await this._app.init();
      this._agent = superTest.agent(this._app.getHttpServer());
    }
    return this._agent;
  }

  public static async closeAgent(): Promise<void> {
    if (this._app) {
      await this._app.close();
      this._agent = undefined;
      this._app = undefined;
    }
  }

  /**
   * 測試數據生成器
   */
  public static generateTestData() {
    return {
      customerId: 'cust_1234567890',
      subscriptionId: 'sub_1234567890',
      paymentMethodId: 'pm_1234567890',
      productId: 'prod_basic_monthly',
      promotionCode: 'SUMMER2024',
      refundId: 'ref_1234567890',
      paymentId: 'pay_1234567890',
    };
  }

  /**
   * 測試用戶創建
   */
  public static createTestUser() {
    return {
      customerId: this.generateTestData().customerId,
      email: 'test@example.com',
      name: 'Test User',
      phone: '+886912345678',
    };
  }

  /**
   * 測試訂閱創建
   */
  public static createTestSubscription() {
    return {
      customerId: this.generateTestData().customerId,
      productId: this.generateTestData().productId,
      paymentMethodId: this.generateTestData().paymentMethodId,
    };
  }
}
