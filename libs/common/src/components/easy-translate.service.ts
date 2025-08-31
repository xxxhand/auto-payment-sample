import { TEasyTranslator } from '@xxxhand/app-common';

export class EasyTranslateService extends TEasyTranslator {
  constructor(resoucesPath: string, fallback: string) {
    super();
    this.useFallbackLng(fallback).useResources(resoucesPath);
  }
}
