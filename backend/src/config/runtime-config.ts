export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface FinwiseRuntimeConfig {
  readonly nodeEnv: RuntimeEnvironment;
  readonly port: number;
  readonly frontendOrigins: readonly string[];
  readonly buildVersion: string;
}

export function readRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FinwiseRuntimeConfig {
  const nodeEnv = parseNodeEnvironment(environment.NODE_ENV);
  const port = parsePort(environment.PORT);

  if (nodeEnv === 'production') {
    requireProductionSecret(environment.DATABASE_URL, 'DATABASE_URL');
    requireProductionSecret(
      environment.FINWISE_JWT_PRIVATE_KEY_BASE64,
      'FINWISE_JWT_PRIVATE_KEY_BASE64',
    );
    requireProductionSecret(
      environment.FINWISE_JWT_PUBLIC_KEY_BASE64,
      'FINWISE_JWT_PUBLIC_KEY_BASE64',
    );
    requireProductionSecret(
      environment.FINWISE_JWT_ISSUER,
      'FINWISE_JWT_ISSUER',
    );
    requireProductionSecret(
      environment.FINWISE_JWT_AUDIENCE,
      'FINWISE_JWT_AUDIENCE',
    );
  }
  const frontendOrigins = parseOrigins(environment.FRONTEND_ORIGINS, nodeEnv);

  return {
    nodeEnv,
    port,
    frontendOrigins,
    buildVersion: environment.FINWISE_BUILD_VERSION?.trim() || 'dev',
  };
}

function parseNodeEnvironment(value: string | undefined): RuntimeEnvironment {
  if (value === undefined || value === '') return 'development';
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  throw new Error('NODE_ENV must be development, test, or production.');
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 3001;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error('PORT must be a number between 1 and 65535.');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a number between 1 and 65535.');
  }
  return port;
}

function parseOrigins(
  value: string | undefined,
  nodeEnv: RuntimeEnvironment,
): readonly string[] {
  const origins = (
    value ?? (nodeEnv === 'production' ? '' : 'http://localhost:3000')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('FRONTEND_ORIGINS must contain at least one origin.');
  }
  if (origins.some((origin) => origin === '*')) {
    throw new Error('FRONTEND_ORIGINS cannot allow wildcard origins.');
  }
  return origins;
}

function requireProductionSecret(
  value: string | undefined,
  name: string,
): void {
  if (!value?.trim()) {
    throw new Error(`${name} is required in production.`);
  }
}
