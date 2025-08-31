import { pino } from 'pino';
import { FileTransport } from './file.transport';
import { LoggerService, LogLevel } from '@nestjs/common';
import { AsyncLocalStorageProvider } from '../clients/async-local-storage.provider';

export class DefaultLoggerService implements LoggerService {
  private _context?: string = '';
  private _logger: pino.Logger;
  private _storageProvider: AsyncLocalStorageProvider;
  private readonly _DEF_LEVEL = 'info';

  public useContext(context: string): DefaultLoggerService {
    this._context = context;
    return this;
  }

  public useStorageProvider(provider: AsyncLocalStorageProvider): DefaultLoggerService {
    this._storageProvider = provider;
    return this;
  }

  public initialFlieTransport(filePath: string): DefaultLoggerService {
    this._logger = FileTransport.getInstance(filePath).logger;
    return this;
  }

  log(message: any, ...optionalParams: any[]) {
    this._logger.info({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  error(message: any, ...optionalParams: any[]) {
    this._logger.error({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  warn(message: any, ...optionalParams: any[]) {
    this._logger.warn({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  debug?(message: any, ...optionalParams: any[]) {
    this._logger.debug({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  verbose?(message: any, ...optionalParams: any[]) {
    this._logger.trace({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  fatal?(message: any, ...optionalParams: any[]) {
    this._logger.fatal({ traceId: this._storageProvider.store, context: this._context, ...optionalParams }, message);
  }
  setLogLevels?(levels: LogLevel[]) {
    const pinoLevels = levels.map((level) => {
      switch (level) {
        case 'log':
          return 'info';
        case 'error':
          return 'error';
        case 'warn':
          return 'warn';
        case 'debug':
          return 'debug';
        case 'verbose':
          return 'trace';
        default:
          return 'info';
      }
    });
    this._logger.level = pinoLevels[0] || this._DEF_LEVEL;
  }
}
