import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('Mock Webhook Controller (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  it('/webhooks/mock (POST) should handle payment.succeeded', async () => {
    const payload = {
      type: 'payment.succeeded',
      data: {
        object: {
          id: 'pay_mock_123',
        },
      },
    };

    const res = await agent.post('/webhooks/mock').send(payload).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ ok: true, eventType: 'payment.succeeded', paymentId: 'pay_mock_123' }));
  });
});
