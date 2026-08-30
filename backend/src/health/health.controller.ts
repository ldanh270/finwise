import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  status(): { readonly status: 'ok'; readonly service: 'finwise-api' } {
    return { status: 'ok', service: 'finwise-api' };
  }
}
