import * as cv from 'class-validator';
import { errConstants } from '@myapp/common';

export class CreateExampleRequest {
  @cv.IsNotEmpty({ message: errConstants.ERR_CLIENT_NAME_EMPTY })
  @cv.IsString({ message: errConstants.ERR_CLIENT_NAME_EMPTY })
  public name: string = '';

  @cv.IsNotEmpty({ message: errConstants.ERR_CLIENT_CALLBACK_URL_EMPTY })
  @cv.IsString({ message: errConstants.ERR_CLIENT_CALLBACK_URL_EMPTY })
  public callbackUrl: string = '';
}
