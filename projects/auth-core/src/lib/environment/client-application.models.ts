export interface ClientApplication {
  clientId: string;
  url: string;
}

export interface ClientApplicationEnvironments {
  development: readonly ClientApplication[];
  production: readonly ClientApplication[];
}

export interface RuntimeEnvironment {
  production: boolean;
}
