import { Module } from '@nestjs/common';
import { FinwiseAuthGuard, FinwiseTokenVerifier } from './finwise-auth.guard';

@Module({
  providers: [FinwiseTokenVerifier, FinwiseAuthGuard],
  exports: [FinwiseTokenVerifier, FinwiseAuthGuard],
})
export class AuthModule {}
