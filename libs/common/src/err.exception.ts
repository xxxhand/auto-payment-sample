import * as util from 'util';
import { HttpException } from '@nestjs/common';
import { CustomDefinition, CustomError, CustomValidator } from '@xxxhand/app-common';

export class ErrException extends HttpException {
  private code: number = 0;
  private msgArgs: Array<string | number> = [];
  private _message: string = '';
  private _codeName: string = '';
  private _result?: any = undefined;
  private _httpStatus: number = 400;

  constructor(message: string, httpStatus: number) {
    super(message, httpStatus);
    this._message = message;
    this._httpStatus = httpStatus;
  }

  public getCode(): number {
    return this.code;
  }
  public setCode(code: number): void {
    this.code = code;
  }

  public getCodeName(): string {
    return this._codeName;
  }

  public setCodeName(name: string): void {
    this._codeName = name;
  }

  public getMessage(): string {
    return this.message;
  }

  public setMessage(message: string): void {
    this._message = message;
    super.message = message;
  }

  public getMsgArgs(): Array<string | number> {
    return this.msgArgs;
  }

  public setMsgArgs(msgArgs: Array<string | number>) {
    this.msgArgs = this.msgArgs.concat(msgArgs);
  }

  public format(): void {
    if (CustomValidator.nonEmptyArray(this.msgArgs)) {
      this.message = util.format(this._message, ...this.msgArgs);
    }
  }

  public getResult(): any {
    return this._result;
  }

  public addExtraResult(result?: any): void {
    if (result) {
      this._result = result;
    }
  }

  public is5xxException(): boolean {
    return this._httpStatus >= 499;
  }

  public static addCodes(codes: CustomDefinition.ICodeStruct[]): void {
    CustomError.addCodes(codes);
  }

  public static newFromCodeName(codeName: string, msgArgs?: Array<string | number>): ErrException {
    const oCode = CustomError.getCode(codeName);
    const exp = new ErrException(oCode.message, oCode.httpStatus);
    exp.setCode(oCode.code);
    exp.setMessage(oCode.message);
    exp.setCodeName(oCode.codeName);
    if (CustomValidator.nonEmptyArray(msgArgs)) {
      exp.setMsgArgs(msgArgs);
    }
    return exp;
  }

  public static newFromException(exception: any): ErrException {
    if (exception instanceof ErrException) {
      return exception;
    }
    if (typeof exception === 'string') {
      return ErrException.newFromCodeName(exception);
    }
    let unSupportedMsg = '[ErrException warning] Not supported error format';
    if (typeof exception !== 'object') {
      return ErrException.newFromCodeName(`${unSupportedMsg}: ${exception}`);
    }

    let exp: ErrException;
    switch (exception.constructor.name) {
      case 'Error':
        exp = ErrException.newFromCodeName(exception.message);
        break;
      case 'CustomError':
        exp = new ErrException(exception.message, exception.httpStatus);
        exp.setCode(exception.code);
        exp.setMessage(exception.message);
        exp.setCodeName(exception.codeName);
        if (CustomValidator.nonEmptyArray(exception.msgArgs)) {
          exp.setMsgArgs(exception.msgArgs);
        }
        break;
      default:
        // For the nestjs exceitions like BadRequestException, NotFoundException...etc, the format would be {"statusCode": number, "message": string, "error": string}
        // Basicly, we do not handle the self formatting like new BadRequestException({...}). if object be offered, we will stringfy it
        // For the class-validator library, the format would be {"statusCode": number, "message": string[], "error": string}
        // Basicly, we only get the first message from the mesage array
        // If we do not find the "message" property in exception, the message will be "Not supported error format"
        try {
          const cErr = (<HttpException>exception).getResponse();

          if (typeof cErr === 'string') {
            exp = ErrException.newFromCodeName(cErr);
            break;
          }
          if (!('message' in cErr)) {
            exp = ErrException.newFromCodeName(unSupportedMsg);
            break;
          }
          if (typeof cErr['message'] === 'string') {
            unSupportedMsg = cErr['message'];
          } else if (Array.isArray(cErr['message']) && cErr['message'].length > 0) {
            unSupportedMsg = cErr['message'].shift();
          }
          exp = ErrException.newFromCodeName(unSupportedMsg);
          if ('msgArgs' in cErr && CustomValidator.nonEmptyArray(<any>cErr.msgArgs)) {
            exp.setMsgArgs(<(string | number)[]>cErr.msgArgs);
          }
        } catch (error) {
          exp = ErrException.newFromCodeName(exception.message);
          break;
        }
    }
    exp.stack = exception.stack;
    return exp;
  }
}
