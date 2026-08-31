import { createHmac } from 'node:crypto';
import { FinwiseTokenVerifier } from './finwise-auth.guard';

describe('FinwiseTokenVerifier', () => {
  const original = {
    devAuth: process.env.FINWISE_DEV_AUTH,
    secret: process.env.SUPABASE_JWT_SECRET,
    issuer: process.env.SUPABASE_JWT_ISSUER,
    audience: process.env.SUPABASE_JWT_AUDIENCE,
  };

  beforeEach(() => {
    process.env.FINWISE_DEV_AUTH = 'false';
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
    process.env.SUPABASE_JWT_ISSUER = 'https://issuer.example';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  });

  afterAll(() => {
    restore('FINWISE_DEV_AUTH', original.devAuth);
    restore('SUPABASE_JWT_SECRET', original.secret);
    restore('SUPABASE_JWT_ISSUER', original.issuer);
    restore('SUPABASE_JWT_AUDIENCE', original.audience);
  });

  it('requires the configured issuer and audience', () => {
    const verifier = new FinwiseTokenVerifier();
    expect(
      verifier.verify(
        `Bearer ${token({ iss: 'https://issuer.example', aud: 'authenticated' })}`,
      ),
    ).toMatchObject({
      userId: 'user-1',
      providerIssuer: 'https://issuer.example',
    });
    expect(() =>
      verifier.verify(
        `Bearer ${token({ iss: 'https://other.example', aud: 'authenticated' })}`,
      ),
    ).toThrow('Authentication');
    expect(() =>
      verifier.verify(
        `Bearer ${token({ iss: 'https://issuer.example', aud: 'other' })}`,
      ),
    ).toThrow('Authentication');
  });
});

function token(overrides: {
  readonly iss: string;
  readonly aud: string;
}): string {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  });
  const signature = createHmac('sha256', 'test-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
