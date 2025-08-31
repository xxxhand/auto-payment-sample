import { IBaseModel } from './base-model.interface';
export interface IExampleModel extends IBaseModel {
  /** Client name */
  name: string;
  /** Client callback url */
  callbackUrl: string;
}
