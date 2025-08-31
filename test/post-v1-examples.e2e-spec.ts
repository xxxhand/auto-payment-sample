import * as _ from 'lodash';
import * as superTest from 'supertest';
import { CustomUtils } from '@xxxhand/app-common';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';

interface IBody {
  name: string;
  callbackUrl: string;
}

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples spec`, () => {
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples`;
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('example');
  const db = dbHelper.mongo;
  const col = 'Examples';
  const defaultBody: IBody = {
    name: 'iLearning',
    callbackUrl: 'https://xxx.ccc.com',
  };
  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
  });
  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });
  describe('Required fields', () => {
    test('[1001] Parameter "name" is empty', async () => {
      const b = _.cloneDeep(defaultBody);
      b.name = '';
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toBe('Client name is empty');
    });
    test('[1001] Parameter "name" is empty with accept-language: zh-tw', async () => {
      const b = _.cloneDeep(defaultBody);
      b.name = '';
      const res = await agent.post(endpoint).set('Accept-Language', 'zh-tw').send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toBe('客戶端名稱為空');
    });
    test('[1002] Parameter "callbackUrl" is empty', async () => {
      const b = _.cloneDeep(defaultBody);
      b.callbackUrl = '';
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1002);
      expect(res.body.message).toBe('Client callback url is empty');
    });
  });
  describe('Validation rules', () => {
    test('[1003] Client name exists', async () => {
      await db.getCollection(col).insertOne({ name: 'xxxhand' });
      const b = _.cloneDeep(defaultBody);
      b.name = 'xxxhand';
      const res = await agent.post(endpoint).send(b);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1003);
      expect(res.body.message).toBe('Client duplicated');
    });
  });
  describe('Success', () => {
    test('Client created', async () => {
      const res = await agent.post(endpoint).send(defaultBody);
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeTruthy();
      // DB checking
      const doc = await db.getCollection(col).findOne(CustomUtils.stringToObjectId(<string>res.body.result));
      expect(doc).toBeTruthy();
      expect(doc.name).toBe('iLearning');
      expect(doc.callbackUrl).toBe('https://xxx.ccc.com');
    });
  });
});
