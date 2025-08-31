import { pino } from 'pino';

export class FileTransport {
  private static _transport: FileTransport;
  private _logger: pino.Logger;

  public get logger() {
    return this._logger;
  }

  private constructor() {}

  private initialLogger(filePath: string): void {
    this._logger = pino({
      timestamp: () => pino.stdTimeFunctions.isoTime(),
      base: { pid: process.pid }, // 移除 hostname，只保留 pid
      transport: {
        targets: [
          {
            target: 'pino/file',
            options: {
              destination: filePath,
              mkdir: true,
            },
            level: 'info',
          },
        ],
      },
    });
  }

  public static getInstance(filePath: string): FileTransport {
    if (!this._transport) {
      this._transport = new FileTransport();
      this._transport.initialLogger(filePath);
    }
    return this._transport;
  }
}
