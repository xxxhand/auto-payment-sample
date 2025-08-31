import * as fs from 'fs-extra';
import { CustomResult, CustomHttpOption } from '@xxxhand/app-common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { Post, Body, Controller, UploadedFile, LoggerService, Get } from '@nestjs/common';

import { ExampleEntity } from '../domain/entities/example.entity';
import { ExampleRepository } from '../infra/repositories/example.repository';
import { CreateExampleRequest } from '../domain/value-objects/create-example.request';
import { SingleUploadFileInterceptor } from '../app-components/single-upload-file.interceptor';

@Controller({
  path: 'examples',
  version: '1',
})
export class ExampleController {
  private readonly _Logger: LoggerService;
  constructor(
    private readonly cmmService: CommonService,
    private readonly repo: ExampleRepository,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(ExampleController.name);
  }

  @Post()
  public async createExample(@Body() body: CreateExampleRequest): Promise<CustomResult> {
    this._Logger.log(`Create client with name: ${body.name}`);
    let currExample = await this.repo.findOneByName(body.name);
    if (currExample) {
      throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_DUPLICATED);
    }
    currExample = new ExampleEntity();
    currExample.name = body.name;
    currExample.callbackUrl = body.callbackUrl;
    currExample = await this.repo.save(currExample);

    return this.cmmService.newResultInstance().withResult(currExample.id);
  }

  @Post('/upload')
  @SingleUploadFileInterceptor()
  public async uploadFile(@Body() body: { account: string }, @UploadedFile() uploadedFile: Express.Multer.File): Promise<CustomResult> {
    fs.unlink(uploadedFile.path);
    return this.cmmService.newResultInstance<{ account: string; file: string }>().withResult({
      account: body.account,
      file: uploadedFile.originalname,
    });
  }

  @Get()
  public async tryHttp(): Promise<CustomResult> {
    const opt = new CustomHttpOption().nonUseCustomResult().targetUrl('https://staging.ipg-services.com/api/v1');

    // const call = await this.httpClient.tryGetJson(opt);
    const call = await this.cmmService.getDefaultHttpClient().tryGetJson(opt);
    return this.cmmService.newResultInstance().withResult(call.result);
  }
}
