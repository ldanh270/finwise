import { Module } from '@nestjs/common';
import { FinwiseAuthGuard, FinwiseTokenVerifier } from './finwise-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService, AUTH_REPOSITORY } from './application/auth.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { JwtTokenService } from './jwt-token.service';

@Module({
  controllers: [AuthController],
  providers: [
    FinwiseTokenVerifier,
    FinwiseAuthGuard,
    JwtTokenService,
    PrismaAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    {
      provide: AuthService,
      inject: [AUTH_REPOSITORY, JwtTokenService],
      useFactory: (
        repository: ConstructorParameters<typeof AuthService>[0],
        jwtTokens: JwtTokenService,
      ) => new AuthService(repository, jwtTokens),
    },
  ],
  exports: [
    FinwiseTokenVerifier,
    FinwiseAuthGuard,
    AuthService,
    JwtTokenService,
  ],
})
export class AuthModule {}
