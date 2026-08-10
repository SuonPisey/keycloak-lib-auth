import {
  ClientApplication,
  ClientApplicationEnvironments,
  RuntimeEnvironment,
} from './client-application.models';

/** Returns an independent client application list for the active build environment. */
export function resolveClientApplications(
  environment: RuntimeEnvironment,
  applications: ClientApplicationEnvironments,
): ClientApplication[] {
  const selected = environment.production
    ? applications.production
    : applications.development;

  return selected.map((application) => ({ ...application }));
}
