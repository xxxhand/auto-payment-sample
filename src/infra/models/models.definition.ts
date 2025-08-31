import type { WithId } from 'mongodb';
import { IExampleModel } from './example.model';

export enum modelNames {
  EXAMPLE = 'Examples',
}

export type IExampleDocument = WithId<IExampleModel>;
