import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';
import { PrismaClient } from '../../generated/prisma/client';

const FINWISE_SCHEMA = 'finwise';
const requireDatabaseDriver = createRequire(__filename);

dotenv.config({ quiet: true });

const FALLBACK_DATABASE_URL = 'postgresql://127.0.0.1:26257/finwise';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly configured = Boolean(process.env.DATABASE_URL);

  constructor() {
    const { PrismaPg } = requireDatabaseDriver(
      '@prisma/adapter-pg',
    ) as typeof import('@prisma/adapter-pg');
    const adapter = new PrismaPg(
      { connectionString: process.env.DATABASE_URL ?? FALLBACK_DATABASE_URL },
      { schema: FINWISE_SCHEMA },
    );

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    if (this.configured) {
      await this.$connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.configured) {
      await this.$disconnect();
    }
  }
}
