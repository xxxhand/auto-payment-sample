import { APP_FILTER } from '@nestjs/core';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleController } from './controllers/exemple.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { PaymentsController } from './controllers/payments.controller';
import { ProductsController } from './controllers/products.controller';
import { PromotionsController } from './controllers/promotions.controller';
import { RefundsController } from './controllers/refunds.controller';
import { AccountController } from './controllers/account.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { SubscriptionRepository } from './infra/repositories/subscription.repository';
import { PaymentRepository } from './infra/repositories/payment.repository';
// Business Services
import { SubscriptionService } from './domain/services/subscription.service';
import { PaymentService } from './domain/services/payment.service';
import { ProductService } from './domain/services/product.service';
import { PromotionService } from './domain/services/promotion.service';
import { RefundService } from './domain/services/refund.service';
import { AccountService } from './domain/services/account.service';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
@Module({
  imports: [CommonModule],
  controllers: [AppController, ExampleController, SubscriptionsController, PaymentsController, ProductsController, PromotionsController, RefundsController, AccountController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    // Repositories
    ExampleRepository,
    SubscriptionRepository,
    PaymentRepository,
    // Business Services
    SubscriptionService,
    PaymentService,
    ProductService,
    PromotionService,
    RefundService,
    AccountService,
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap, BeforeApplicationShutdown {
  constructor(private readonly cmmService: CommonService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppTracerMiddleware).forRoutes('*');
  }

  async onApplicationBootstrap() {}

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  async beforeApplicationShutdown(signal?: string) {
    this.cmmService.releaseResources();
  }
}
