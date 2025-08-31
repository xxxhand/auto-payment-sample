import { DEFAULT_MONGO } from '@myapp/common';
import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CustomDefinition, CustomValidator, CustomMongoClient } from '@xxxhand/app-common';
import { ExampleEntity } from '../../domain/entities/example.entity';
import { modelNames, IExampleDocument } from '../models/models.definition';

@Injectable()
export class ExampleRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly defMongoClient: CustomMongoClient) {}

  public async save(entity: ExampleEntity): Promise<CustomDefinition.TNullable<ExampleEntity>> {
    if (!entity) {
      return undefined;
    }
    if (!CustomValidator.nonEmptyString(entity.id)) {
      const doc = <IExampleDocument>{
        name: entity.name,
        callbackUrl: entity.callbackUrl,
      };
      const col = this.defMongoClient.getCollection(modelNames.EXAMPLE);
      const docRes = await col.insertOne(doc);
      entity.id = docRes.insertedId.toHexString();
      return entity;
    }

    return entity;
  }

  public async findOneByName(name: string): Promise<CustomDefinition.TNullable<ExampleEntity>> {
    if (!CustomValidator.nonEmptyString(name)) {
      return undefined;
    }
    const col = this.defMongoClient.getCollection(modelNames.EXAMPLE);
    const q = { name };
    const doc = (await col.findOne(q)) as IExampleDocument;
    if (!doc) {
      return undefined;
    }
    const ent = plainToInstance(ExampleEntity, doc);
    ent.id = doc._id.toHexString();
    return ent;
  }
}
