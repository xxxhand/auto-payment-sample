import * as superTest from 'supertest';
import { InjectionToken } from '@nestjs/common';
import { DEFAULT_HTTP_CLIENT } from '@myapp/common';
import { AppHelper } from './__helpers__/app.helper';

describe(`GET ${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples spec`, () => {
  const endpoint = `${process.env.DEFAULT_API_ROUTER_PREFIX}/v1/examples`;
  let agent: superTest.SuperAgentTest;
  beforeAll(async () => {
    const mockedHttpClient = {
      tryGetJson: jest.fn().mockResolvedValue({
        result: 'I am from mock',
      }),
    };
    const thisMcokers: Map<InjectionToken, any> = new Map().set(DEFAULT_HTTP_CLIENT, mockedHttpClient);
    agent = await AppHelper.getAgentWithMockers(thisMcokers);
  });
  afterAll(async () => {
    await AppHelper.closeAgent();
  });
  test('[Mock] Should retrieve success body from other web server', async () => {
    const res = await agent.get(endpoint);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('I am from mock');
  });
});
