import { APP_FILTER } from '@nestjs/core';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleController } from './controllers/exemple.controller';
import { CustomersController } from './controllers/customers.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { PaymentsController } from './controllers/payments.controller';
import { BillingController } from './controllers/billing.controller';
import { ProductsController } from './controllers/products.controller';
import { PromotionsController } from './controllers/promotions.controller';
import { RefundsController } from './controllers/refunds.controller';
import { AccountController } from './controllers/account.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { CustomerRepository } from './infra/repositories/customer.repository';
import { SubscriptionRepository } from './infra/repositories/subscription.repository';
import { PaymentRepository } from './infra/repositories/payment.repository';
// Business Services
import { CustomerService } from './domain/services/customer.service';
import { SubscriptionService } from './domain/services/subscription.service';
import { PaymentService } from './domain/services/payment.service';
import { ProductService } from './domain/services/product.service';
import { PromotionService } from './domain/services/promotion.service';
import { RefundService } from './domain/services/refund.service';
import { AccountService } from './domain/services/account.service';
import { BillingService } from './domain/services/billing.service';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
@Module({
  imports: [CommonModule],
  controllers: [
    AppController,
    ExampleController,
    CustomersController,
    SubscriptionsController,
    PaymentsController,
    BillingController,
    ProductsController,
    PromotionsController,
    RefundsController,
    AccountController,
  ],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    // Repositories
    ExampleRepository,
    CustomerRepository,
    SubscriptionRepository,
    PaymentRepository,
    // Business Services
    CustomerService,
    SubscriptionService,
    PaymentService,
    ProductService,
    PromotionService,
    RefundService,
    AccountService,
    BillingService,
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
