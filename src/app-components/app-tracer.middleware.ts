import { NestMiddleware, Injectable } from '@nestjs/common';
import { CustomUtils } from '@xxxhand/app-common';
import { Request, Response, NextFunction } from 'express';
import { usedHttpHeaders, CommonService } from '@myapp/common';

@Injectable()
export class AppTracerMiddleware implements NestMiddleware {
  constructor(private readonly cmmService: CommonService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const reqId = (req.headers[usedHttpHeaders.X_TRACE_ID] as string) || CustomUtils.makeUUID();
    this.cmmService.getLocalStorage().run(reqId, () => next());
  }
}
