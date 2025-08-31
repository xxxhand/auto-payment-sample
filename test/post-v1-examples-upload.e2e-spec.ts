import * as path from 'path';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe(`POST ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples/upload spec`, () => {
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples/upload`;
  let agent: superTest.SuperAgentTest;
  const testFile = path.join(__dirname, '/__upload-files__/test-file-2.jpeg');
  beforeAll(async () => {
    agent = await AppHelper.getAgent();
  });
  afterAll(async () => {
    await AppHelper.closeAgent();
  });
  describe('Success', () => {
    test('Upload done', async () => {
      const res = await agent.post(endpoint).field('account', 'xxxhand').attach('file', testFile);

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('');
      expect(res.body.result).toBeTruthy();
      expect(res.body.result.account).toBe('xxxhand');
      expect(res.body.result.file).toBe('test-file-2.jpeg');
    });
  });
});
