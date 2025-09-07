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
import { ECPayWebhookController } from './controllers/ecpay-webhook.controller';
import { HealthController } from './controllers/health.controller';
import { DebugController } from './controllers/debug.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { CustomerRepository } from './infra/repositories/customer.repository';
import { SubscriptionRepository } from './infra/repositories/subscription.repository';
import { PaymentRepository } from './infra/repositories/payment.repository';
import { ProductRepository } from './infra/repositories/product.repository';
import { BillingPlanRepository } from './infra/repositories/billing-plan.repository';
// Business Services
import { CustomerService } from './domain/services/customer.service';
import { SubscriptionService } from './domain/services/subscription.service';
import { PaymentService } from './domain/services/payment.service';
import { ProductService } from './domain/services/product.service';
import { PromotionService } from './domain/services/promotion.service';
import { RefundService } from './domain/services/refund.service';
import { AccountService } from './domain/services/account.service';
// Application Services
import { ProductApplicationService } from './application/product.application.service';
import { SubscriptionApplicationService } from './application/subscription.application.service';
// Payment Module
import { PaymentModule } from './domain/services/payment/payment.module';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
@Module({
  imports: [CommonModule, PaymentModule],
  controllers: [
    AppController,
    ExampleController,
    SubscriptionsController,
    PaymentsController,
    ProductsController,
    PromotionsController,
    RefundsController,
    AccountController,
    ECPayWebhookController,
    HealthController,
    DebugController,
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
    ProductRepository,
    BillingPlanRepository,
    // Business Services
    CustomerService,
    SubscriptionService,
    PaymentService,
    ProductService,
    PromotionService,
    RefundService,
    AccountService,
    // Application Services
    ProductApplicationService,
    SubscriptionApplicationService,
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
