import { readRuntimeConfig } from './runtime-config';

describe('readRuntimeConfig', () => {
  it('uses safe development defaults', () => {
    expect(readRuntimeConfig({})).toEqual({
      nodeEnv: 'development',
      port: 3001,
      frontendOrigins: ['http://localhost:3000'],
      buildVersion: 'dev',
    });
  });

  it('parses explicit port and multiple origins', () => {
    expect(
      readRuntimeConfig({
        NODE_ENV: 'test',
        PORT: '4100',
        FRONTEND_ORIGINS: 'https://app.example, https://admin.example ',
        FINWISE_BUILD_VERSION: '2026.08.31',
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 4100,
      frontendOrigins: ['https://app.example', 'https://admin.example'],
      buildVersion: '2026.08.31',
    });
  });

  it('fails closed for malformed ports and wildcard origins', () => {
    expect(() => readRuntimeConfig({ PORT: '0' })).toThrow('PORT');
    expect(() => readRuntimeConfig({ FRONTEND_ORIGINS: '*' })).toThrow(
      'wildcard',
    );
  });

  it('requires production persistence and auth secrets', () => {
    expect(() => readRuntimeConfig({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL',
    );
    expect(() =>
      readRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://db',
        FINWISE_JWT_PRIVATE_KEY_BASE64: 'private',
        FINWISE_JWT_PUBLIC_KEY_BASE64: 'public',
        FRONTEND_ORIGINS: 'https://app.example',
      }),
    ).toThrow('FINWISE_JWT_ISSUER');
  });
});
