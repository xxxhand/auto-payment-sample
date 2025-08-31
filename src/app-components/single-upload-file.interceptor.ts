import { cmmConf } from '@myapp/conf';
import { CustomValidator } from '@xxxhand/app-common';
import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, MulterModuleOptions } from '@nestjs/platform-express';

export interface ISingleUploadOptions {
  field: string;
  maxSize: number;
  acceptMimeTypes: string[];
}

export const SingleUploadFileInterceptor = (opt?: ISingleUploadOptions) => {
  if (!opt) {
    opt = {
      field: 'file',
      maxSize: cmmConf.defaultUploadMaxSize,
      acceptMimeTypes: [],
    };
  }
  const currOpt: MulterModuleOptions = {
    dest: cmmConf.defaultUploadTmpDir,
    limits: {
      fileSize: cmmConf.defaultUploadMaxSize,
    },
  };
  currOpt.limits.fileSize = opt.maxSize;
  if (CustomValidator.nonEmptyArray(opt.acceptMimeTypes)) {
    currOpt.fileFilter = (req, file, cb) => {
      if (!opt.acceptMimeTypes.includes(file.mimetype)) {
        return cb(new Error(), false);
      }
      cb(null, true);
    };
  }

  return applyDecorators(UseInterceptors(FileInterceptor(opt.field, currOpt)));
};
