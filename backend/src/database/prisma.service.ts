import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';
import { PrismaClient } from '../../generated/prisma/client';

const FINWISE_SCHEMA = 'finwise';
const requireDatabaseDriver = createRequire(__filename);

dotenv.config({ quiet: true });

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to start the backend database client.',
    );
  }

  return databaseUrl;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const { PrismaPg } = requireDatabaseDriver(
      '@prisma/adapter-pg',
    ) as typeof import('@prisma/adapter-pg');
    const adapter = new PrismaPg(
      { connectionString: getDatabaseUrl() },
      { schema: FINWISE_SCHEMA },
    );

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
