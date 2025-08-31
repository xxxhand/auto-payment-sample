import { CustomDefinition } from '@xxxhand/app-common';
import { errConstants } from './err.const';

export const errCodes: CustomDefinition.ICodeStruct[] = [
  {
    codeName: errConstants.ERR_CLIENT_NAME_EMPTY,
    code: 1001,
    httpStatus: 400,
    message: 'Client name is empty',
  },
  {
    codeName: errConstants.ERR_CLIENT_CALLBACK_URL_EMPTY,
    code: 1002,
    httpStatus: 400,
    message: 'Client callback url is empty',
  },
  {
    codeName: errConstants.ERR_CLIENT_DUPLICATED,
    code: 1003,
    httpStatus: 400,
    message: 'Client duplicated',
  },
];
