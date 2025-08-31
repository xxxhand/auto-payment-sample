import * as fs from 'fs-extra';
import { Request, Response } from 'express';
import { ErrException, CommonService, usedHttpHeaders } from '@myapp/common';
import { ExceptionFilter, Catch, ArgumentsHost, LoggerService } from '@nestjs/common';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly _Logger: LoggerService;
  constructor(private readonly cmmService: CommonService) {
    this._Logger = this.cmmService.getDefaultLogger(AppExceptionFilter.name);
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const err = ErrException.newFromException(exception);
    const logStr = `${req.method} ${req.originalUrl} - ${err.getStatus()}(${err.getCodeName()})`;
    if (err.is5xxException()) {
      this._Logger.error(logStr);
      this._Logger.error(err.stack);
    } else {
      err.setMessage(this.cmmService.t(err.getCodeName(), req.get(usedHttpHeaders.ACCEPT_LANG)));
      err.format();
      this._Logger.warn(logStr);
    }

    if (res.headersSent) return;
    res.status(err.getStatus()).json(this.cmmService.newResultInstance().withCode(err.getCode()).withMessage(err.getMessage()));
    // Delete uploaded files
    const tasks = [];
    if (req.file) {
      tasks.push(fs.unlink(req.file.path));
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach((x) => tasks.push(fs.unlink(x.path)));
      } else {
        Object.keys(req.files).forEach((k: string) => (req.files[k] as Express.Multer.File[]).forEach((x: Express.Multer.File) => tasks.push(fs.unlink(x.path))));
      }
    }
    Promise.all(tasks).catch((ex) => this._Logger.warn(ex));
  }
}
