import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { IConf, ConfService } from '@myapp/conf';
import { CustomResult, TEasyTranslator, CustomUtils, CustomHttpClient, CustomMongoClient } from '@xxxhand/app-common';
import { DEFAULT_MONGO, DEFAULT_TRANSLATE, DEFAULT_HTTP_CLIENT } from './common.const';
import { DefaultLoggerService } from './components/default-logger.service';
import { AsyncLocalStorageProvider } from './clients/async-local-storage.provider';
@Injectable()
export class CommonService {
  constructor(
    @Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient,
    @Inject(DEFAULT_TRANSLATE) private readonly defTrans: TEasyTranslator,
    @Inject(DEFAULT_HTTP_CLIENT) private readonly defHttpClient: CustomHttpClient,
    private readonly confService: ConfService,
    private readonly alsProvider: AsyncLocalStorageProvider,
  ) {}

  /** Get current project configuration */
  public getConf(): IConf {
    return this.confService.getConf();
  }

  /** Get default mongoose client */
  public getDefaultMongooseClient(): CustomMongoClient {
    return this.defMongoClient;
  }

  /** Get default logger with context name */
  public getDefaultLogger(context: string): LoggerService {
    return new DefaultLoggerService().useContext(context).useStorageProvider(this.alsProvider).initialFlieTransport(this.confService.getConf().defaultLoggerPath);
  }

  /** Get current asyncLocalStorage */
  public getLocalStorage(): AsyncLocalStorageProvider {
    return this.alsProvider;
  }

  /** For multi langs translation */
  public t(key: string, locale?: string): string {
    return this.defTrans.t(key, CustomUtils.getLangOrDefault(locale, this.confService.getConf().fallbackLocale));
  }

  /** Get current http client */
  public getDefaultHttpClient(): CustomHttpClient {
    return this.defHttpClient;
  }

  /** To build new one CustomResult object within trace id */
  public newResultInstance<T = any>(): CustomResult<T> {
    return new CustomResult<T>().withTraceId(this.alsProvider.store);
  }
  /** To release all used resouces, usually using on application shutdown */
  public async releaseResources(): Promise<void> {
    this.defMongoClient.close();
  }
}
