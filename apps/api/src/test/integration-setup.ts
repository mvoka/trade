import { PrismaClient } from '@trades/prisma';

// Use test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();

// Clean database before each test file
beforeAll(async () => {
  // Ensure we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration tests must run in test environment');
  }
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
