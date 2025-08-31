import { APP_FILTER } from '@nestjs/core';
import { CommonModule, CommonService } from '@myapp/common';
import { Module, BeforeApplicationShutdown, MiddlewareConsumer, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ExampleController } from './controllers/exemple.controller';
import { ExampleRepository } from './infra/repositories/example.repository';
import { AppExceptionFilter } from './app-components/app-exception.filter';
import { AppTracerMiddleware } from './app-components/app-tracer.middleware';
@Module({
  imports: [CommonModule],
  controllers: [AppController, ExampleController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    ExampleRepository,
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
