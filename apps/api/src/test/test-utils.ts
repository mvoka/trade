import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../common/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  request: request.SuperTest<request.Test>;
}

export async function createTestApp(module: any): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);

  return {
    app,
    prisma,
    request: request(app.getHttpServer()),
  };
}

export async function cleanupTestApp(testApp: TestApp) {
  await testApp.app.close();
}

export function generateUniqueEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

export async function createTestUser(
  prisma: PrismaService,
  data: {
    email?: string;
    password?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  } = {},
) {
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash(data.password || 'TestPassword123!', 12);

  return prisma.user.create({
    data: {
      email: data.email || generateUniqueEmail(),
      passwordHash,
      role: (data.role || 'SMB_USER') as any,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'User',
    },
  });
}

export async function getAuthTokens(
  testApp: TestApp,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await testApp.request.post('/auth/login').send({ email, password }).expect(200);

  return {
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}
