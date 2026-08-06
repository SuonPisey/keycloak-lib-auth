import { parseKeycloakAuthority } from './keycloak-auth.config';

describe('parseKeycloakAuthority', () => {
  it('extracts the base URL and realm from a Keycloak authority', () => {
    expect(
      parseKeycloakAuthority('https://iam.example.com/auth/realms/internal', 'portal'),
    ).toEqual({
      url: 'https://iam.example.com/auth',
      realm: 'internal',
      clientId: 'portal',
    });
  });
});
