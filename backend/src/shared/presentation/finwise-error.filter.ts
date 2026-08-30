import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { FinwiseError } from '../errors/finwise-error';
import { AuthenticatedRequest } from '../../auth/finwise-auth.guard';

@Catch()
export class FinwiseErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();
    const requestId =
      request.requestId ?? response.getHeader('x-request-id')?.toString();
    if (exception instanceof FinwiseError) {
      response.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
        ...(requestId ? { requestId } : {}),
      });
      return;
    }
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        code: 'VALIDATION_ERROR',
        message: 'The request could not be processed.',
        ...(requestId ? { requestId } : {}),
      });
      return;
    }
    response.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      ...(requestId ? { requestId } : {}),
    });
  }
}
