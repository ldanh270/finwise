import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedActor } from '../shared/application/auth';
import { AuthenticatedRequest, actorFromRequest } from './finwise-auth.guard';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return actorFromRequest(request);
  },
);
