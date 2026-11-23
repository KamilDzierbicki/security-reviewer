import { PasswordHasher } from '@nestjs/authentication';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ENTITIES } from '../src/database/entities.js';
import { InitialSchema1795456874195 } from '../src/database/migrations/1795456874195-InitialSchema.js';

async function resetDatabase(): Promise<void> {
  const dataSource = await new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: ENTITIES,
    migrations: [InitialSchema1795456874195],
    dropSchema: true,
    migrationsRun: true,
  }).initialize();
  await dataSource.destroy();
}

describe('sign-up and sign-in (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    await resetDatabase();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PasswordHasher)
      .useValue(new PasswordHasher({ logN: 10 }))
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets a user in only with the token from sign-in', async () => {
    const server = app.getHttpServer();
    const credentials = {
      email: 'e2e@example.test',
      password: 'correct-horse-battery',
    };

    await request(server).get('/api/repositories').expect(401);
    await request(server)
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    await request(server)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'E2E@Example.TEST' })
      .expect(409);
    await request(server)
      .post('/api/auth/register')
      .send({ email: 'spaces@example.test', password: ' '.repeat(12) })
      .expect(400);
    await request(server)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong-password-123' })
      .expect(401);

    const signIn = await request(server)
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);
    await request(server)
      .get('/api/repositories')
      .set('Authorization', `Bearer ${signIn.body.accessToken}`)
      .expect(200, []);
  });
});
