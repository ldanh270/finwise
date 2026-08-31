import { requestIdFor } from './request-id';

describe('requestIdFor', () => {
  it('preserves safe correlation ids', () => {
    expect(requestIdFor(' pilot-123 ')).toBe('pilot-123');
  });

  it('replaces unsafe and missing ids with a generated value', () => {
    expect(requestIdFor('bad id', () => 'generated')).toBe('generated');
    expect(requestIdFor(undefined, () => 'generated')).toBe('generated');
  });
});
