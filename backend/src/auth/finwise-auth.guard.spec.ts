import { generateKeyPairSync, sign } from 'node:crypto';
import { FinwiseTokenVerifier } from './finwise-auth.guard';
import { JwtTokenService } from './jwt-token.service';

describe('FinwiseTokenVerifier', () => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  const original = {
    devAuth: process.env.FINWISE_DEV_AUTH,
    issuer: process.env.FINWISE_JWT_ISSUER,
    audience: process.env.FINWISE_JWT_AUDIENCE,
    keyId: process.env.FINWISE_JWT_KEY_ID,
    privateKey: process.env.FINWISE_JWT_PRIVATE_KEY_BASE64,
    publicKey: process.env.FINWISE_JWT_PUBLIC_KEY_BASE64,
  };

  beforeEach(() => {
    process.env.FINWISE_DEV_AUTH = 'false';
    process.env.FINWISE_JWT_ISSUER = 'https://issuer.example';
    process.env.FINWISE_JWT_AUDIENCE = 'finwise-api';
    process.env.FINWISE_JWT_KEY_ID = 'test-key';
    process.env.FINWISE_JWT_PRIVATE_KEY_BASE64 =
      keys.privateKey.toString('base64');
    process.env.FINWISE_JWT_PUBLIC_KEY_BASE64 =
      keys.publicKey.toString('base64');
  });

  afterAll(() => {
    restore('FINWISE_DEV_AUTH', original.devAuth);
    restore('FINWISE_JWT_ISSUER', original.issuer);
    restore('FINWISE_JWT_AUDIENCE', original.audience);
    restore('FINWISE_JWT_KEY_ID', original.keyId);
    restore('FINWISE_JWT_PRIVATE_KEY_BASE64', original.privateKey);
    restore('FINWISE_JWT_PUBLIC_KEY_BASE64', original.publicKey);
  });

  it('verifies signed access tokens and rejects issuer or audience changes', () => {
    const jwt = new JwtTokenService();
    const verifier = new FinwiseTokenVerifier(jwt);
    const token = jwt.issueAccessToken(
      {
        userId: 'user-1',
        providerIssuer: 'https://issuer.example',
        providerSubject: 'user-1',
        email: 'user@example.com',
      },
      'session-1',
    ).accessToken;
    expect(verifier.verify(`Bearer ${token}`)).toMatchObject({
      userId: 'user-1',
      providerIssuer: 'https://issuer.example',
      email: 'user@example.com',
    });
    expect(() =>
      verifier.verify(
        `Bearer ${alterClaim(token, 'iss', 'https://other.example')}`,
      ),
    ).toThrow('Authentication');
    expect(() =>
      verifier.verify(`Bearer ${alterClaim(token, 'aud', 'other')}`),
    ).toThrow('Authentication');
  });

  it('keeps the local dev header compatibility path outside production', () => {
    process.env.FINWISE_DEV_AUTH = 'true';
    const verifier = new FinwiseTokenVerifier(new JwtTokenService());
    expect(verifier.verify(undefined, 'dev-user')).toMatchObject({
      userId: 'dev-user',
    });
  });
});

function alterClaim(
  token: string,
  claim: 'iss' | 'aud',
  value: string,
): string {
  const [header, payload] = token.split('.');
  const decoded = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
  decoded[claim] = value;
  const encodedPayload = Buffer.from(JSON.stringify(decoded)).toString(
    'base64url',
  );
  const input = `${header}.${encodedPayload}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), {
    key: Buffer.from(
      process.env.FINWISE_JWT_PRIVATE_KEY_BASE64 ?? '',
      'base64',
    ),
    format: 'der',
    type: 'pkcs8',
  }).toString('base64url');
  return `${input}.${signature}`;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
