import { cmmConf } from '@myapp/conf';
import { INestApplication } from '@nestjs/common';
import { RequestMethod, VersioningType, ValidationPipe } from '@nestjs/common';

export function runInitial(app: INestApplication): void {
  // 啟用application shutdown通知
  app.enableShutdownHooks();
  // 啟用Api path versioning
  app.enableVersioning({ type: VersioningType.URI });
  // 設置Api path 前綴字
  app.setGlobalPrefix(
    cmmConf.defaultApiRouterPrefix,
    // 設定要忽略前綴的routes
    { exclude: [{ path: '/', method: RequestMethod.GET }] },
  );
  app.enableCors({ origin: '*' });

  // 設定驗證request body
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
}
