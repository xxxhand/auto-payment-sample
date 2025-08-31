import { Injectable } from '@nestjs/common';
import { IConf, cmmConf } from './conf.present';

@Injectable()
export class ConfService {
  public getConf = (): IConf => cmmConf;
}
