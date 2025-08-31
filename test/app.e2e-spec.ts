import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('AppController (e2e)', () => {
  let agent: superTest.SuperAgentTest;
  beforeAll(async () => {
    agent = await AppHelper.getAgent();
  });
  afterAll(async () => {
    await AppHelper.closeAgent();
  });
  it('/ (GET)', () => {
    return agent.get('/').expect(200).expect('Hello World!');
  });
});
