import { ClientApplicationEnvironments } from './client-application.models';

/** Central microfrontend locations. Replace mock production hosts before deployment. */
export const CLIENT_APPLICATIONS: ClientApplicationEnvironments = {
  development: [
    { clientId: 'hb-ui-hr', url: 'http://localhost:4201' },
    { clientId: 'hb-ui-internal', url: 'http://localhost:4200' },
  ],
  production: [
    { clientId: 'hb-ui-hr', url: 'https://hr.example.com' },
    { clientId: 'hb-ui-internal', url: 'https://internal.example.com' },
  ],
};
