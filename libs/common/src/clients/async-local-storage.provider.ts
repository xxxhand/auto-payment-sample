import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AsyncLocalStorageProvider {
  private readonly asyncLocalStorage = new AsyncLocalStorage<string>();

  get store() {
    return this.asyncLocalStorage.getStore();
  }

  run(store: string, callback: () => void) {
    this.asyncLocalStorage.run(store, callback);
  }
}
