import { describe, expect, it } from 'vitest';
import { resolveClientApplications } from './resolve-client-applications';

const applications = {
  development: [{ clientId: 'portal-dev', url: 'http://localhost:4200' }],
  production: [{ clientId: 'portal', url: 'https://portal.example.com' }],
};

describe('resolveClientApplications', () => {
  it('returns development applications for a development build', () => {
    expect(resolveClientApplications({ production: false }, applications)).toEqual(
      applications.development,
    );
  });

  it('returns production applications for a production build', () => {
    expect(resolveClientApplications({ production: true }, applications)).toEqual(
      applications.production,
    );
  });

  it('returns a copy that callers can safely modify', () => {
    const result = resolveClientApplications({ production: false }, applications);
    result[0].url = 'changed';
    expect(applications.development[0].url).toBe('http://localhost:4200');
  });
});
