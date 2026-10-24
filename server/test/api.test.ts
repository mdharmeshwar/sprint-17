import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import request from 'supertest';

process.env.JWT_SECRET = 'taskmatrix-test-secret';
process.env.AI_RATE_LIMIT_MAX = '5';
process.env.LOGIN_RATE_LIMIT_MAX = '5';
process.env.CLIENT_URL = 'https://taskmatrix-web.example.test';
delete process.env.MONGODB_URI;
delete process.env.OPENAI_API_KEY;

const { default: app } = await import('../src/app.js');
const { memoryTasks, memoryUsers } = await import('../src/utils/memoryStore.js');
const { getJwtSecret } = await import('../src/utils/jwt.js');
const { isDevelopmentOrigin, resolveAllowedOrigins } = await import('../src/config/cors.js');
process.env.MONGODB_URI = '';

test('CORS accepts configured origins, handles preflight, and rejects unlisted origins', async () => {
  const allowedOrigin = 'https://taskmatrix-web.example.test';
  const response = await request(app).get('/api/health').set('Origin', allowedOrigin);
  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], allowedOrigin);

  const preflight = await request(app)
    .options('/api/tasks')
    .set('Origin', allowedOrigin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], allowedOrigin);
  assert.equal(preflight.headers['access-control-allow-credentials'], undefined);

  const rejected = await request(app).get('/api/health').set('Origin', 'https://untrusted.example.test');
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);

  assert.throws(() => resolveAllowedOrigins('http://localhost:5173', true), /HTTPS and a public hostname/);
  assert.throws(() => resolveAllowedOrigins('*', true), /exact origins/);
  assert.equal(isDevelopmentOrigin('http://localhost:54321'), true);
});

test('JWT secret rejects the development fallback in production', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /JWT_SECRET is required in production/);
  process.env.NODE_ENV = previousEnvironment;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test('API validates writes, preserves CRUD, handles errors, and protects AI limits', async () => {
  memoryTasks.splice(0);
  memoryUsers.splice(0);

  let providerOutput = '{"suggestion":"A clearer task description."}';
  let providerCalls = 0;
  const providerServer = createServer((req, res) => {
    providerCalls += 1;
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'resp_test',
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        status: 'completed',
        model: 'mock-model',
        output: [{
          id: 'msg_test',
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: providerOutput, annotations: [] }],
        }],
      }));
    });
  });
  await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
  const address = providerServer.address();
  assert.ok(address && typeof address === 'object');
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.OPENAI_API_KEY = 'test-only-key';

  try {
    const invalidRegistration = await request(app).post('/api/auth/register').send({ name: 'No email' });
    assert.equal(invalidRegistration.status, 400);
    assert.equal(invalidRegistration.body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalidRegistration.body.errors));

    const registration = await request(app).post('/api/auth/register').send({
      name: 'Test User', email: 'test@example.com', password: 'password123',
    });
    assert.equal(registration.status, 201);
    const token = registration.body.token as string;
    const auth = { Authorization: `Bearer ${token}` };

    delete process.env.OPENAI_API_KEY;
    const missingProviderConfig = await request(app).post('/api/ai/suggest').set(auth).send({ text: 'task text' });
    assert.equal(missingProviderConfig.status, 503);
    assert.equal(missingProviderConfig.body.code, 'AI_PROVIDER_UNAVAILABLE');
    process.env.OPENAI_API_KEY = 'test-only-key';

    const invalidTask = await request(app).post('/api/tasks').set(auth).send({
      title: 'Task', description: 'Description', priority: 'impossible', status: 'todo',
    });
    assert.equal(invalidTask.status, 400);
    assert.equal(invalidTask.body.code, 'VALIDATION_ERROR');

    const unauthorizedTasks = await request(app).get('/api/tasks');
    assert.equal(unauthorizedTasks.status, 401);

    const taskResponse = await request(app).post('/api/tasks').set(auth).send({
      title: 'Task', description: 'Description', priority: 'medium', status: 'todo',
    });
    assert.equal(taskResponse.status, 201);
    const taskId = taskResponse.body.data._id as string;
    const taskList = await request(app).get('/api/tasks').set(auth);
    assert.equal(taskList.status, 200);
    assert.equal(taskList.body.data.length, 1);

    const protectedFieldUpdate = await request(app).put(`/api/tasks/${taskId}`).set(auth).send({
      status: 'done', authorId: 'attacker',
    });
    assert.equal(protectedFieldUpdate.status, 400);

    const statusUpdate = await request(app).put(`/api/tasks/${taskId}`).set(auth).send({ status: 'done' });
    assert.equal(statusUpdate.status, 200);
    assert.equal(statusUpdate.body.data.status, 'done');

    const invalidId = await request(app).get('/api/tasks/not-a-valid-object-id').set(auth);
    assert.equal(invalidId.status, 400);
    const absentTask = await request(app).get('/api/tasks/abcdefghijkl').set(auth);
    assert.equal(absentTask.status, 404);

    const invalidAi = await request(app).post('/api/ai/suggest').set(auth).send({ text: '' });
    assert.equal(invalidAi.status, 400);
    assert.equal(providerCalls, 0);

    const oversizedAi = await request(app).post('/api/ai/suggest').set(auth).send({ text: 'x'.repeat(2001) });
    assert.equal(oversizedAi.status, 400);
    assert.equal(providerCalls, 0);

    const successfulAi = await request(app).post('/api/ai/suggest').set(auth).send({ text: 'make this clearer' });
    assert.equal(successfulAi.status, 200);
    assert.deepEqual(successfulAi.body, { success: true, data: { suggestion: 'A clearer task description.' } });
    assert.equal(providerCalls, 1);

    providerOutput = 'not valid JSON';
    const malformedAi = await request(app).post('/api/ai/suggest').set(auth).send({ text: 'another task' });
    assert.equal(malformedAi.status, 502);
    assert.equal(malformedAi.body.code, 'AI_PROVIDER_UNAVAILABLE');
    assert.equal(JSON.stringify(malformedAi.body).includes('not valid JSON'), false);

    const limitedAi = await request(app).post('/api/ai/suggest').set(auth).send({ text: 'rate limited' });
    assert.equal(limitedAi.status, 429);
    assert.equal(limitedAi.body.code, 'RATE_LIMITED');

    const notFound = await request(app).get('/api/missing');
    assert.equal(notFound.status, 404);
    assert.deepEqual(notFound.body.errors, []);

    const deleteTask = await request(app).delete(`/api/tasks/${taskId}`).set(auth);
    assert.equal(deleteTask.status, 200);
    assert.equal((await request(app).get(`/api/tasks/${taskId}`).set(auth)).status, 404);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await request(app).post('/api/auth/login').send({
        email: 'test@example.com', password: 'incorrect-password',
      });
      assert.equal(failedLogin.status, 401);
    }
    const limitedLogin = await request(app).post('/api/auth/login').send({
      email: 'test@example.com', password: 'incorrect-password',
    });
    assert.equal(limitedLogin.status, 429);
    assert.equal(limitedLogin.body.code, 'RATE_LIMITED');
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    await new Promise<void>((resolve, reject) => {
      (providerServer as Server).close((error) => error ? reject(error) : resolve());
    });
  }
});