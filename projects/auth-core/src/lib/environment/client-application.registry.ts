import { ClientApplicationEnvironments } from './client-application.models';

/** Central microfrontend locations. Replace mock production hosts before deployment. */
export const CLIENT_APPLICATIONS: ClientApplicationEnvironments = {
  development: [
    { clientId: 'hb-ui-hr', url: 'http://localhost:4201' },
    { clientId: 'hb-ui-internal', url: 'http://localhost:4200' },
    { clientId: 'hb-ui-it', url: 'http://localhost:4202' },
    { clientId: 'hb-ui-general', url: 'http://localhost:4203' },
  ],
  production: [
    { clientId: 'hb-ui-hr', url: 'https://hr.example.com' },
    { clientId: 'hb-ui-internal', url: 'https://internal.example.com' },
    { clientId: 'hb-ui-it', url: 'https://it.example.com' },
    { clientId: 'hb-ui-general', url: 'https://general.example.com' },
  ],
};
