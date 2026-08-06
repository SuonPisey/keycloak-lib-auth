# @suonpisey/auth-core

Reusable Angular building blocks for Keycloak authentication, permission checks,
and IAM-driven grouped sidebar navigation.

## Install

```bash
npm install @suonpisey/auth-core keycloak-js
```

## Configure authentication

Register the library once in the application configuration. This also installs
the bearer-token HTTP interceptor.

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAuthCore } from '@suonpisey/auth-core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),
    provideAuthCore({
      authority: 'https://iam.example.com/realms/internal',
      clientId: 'hb-it-internal',
      redirectUri: '/',
      postLogoutRedirectUri: '/login',
      scope: 'openid profile email',
    }),
  ],
};
```

Initialize authentication during application startup or in the root component:

```ts
constructor(private readonly auth: KeycloakAuthService) {
  void this.auth.initialize();
}
```

The consuming application must provide
`/assets/silent-check-sso.html` when iframe session checks are enabled.

## Permissions

```ts
const permissions = inject(PermissionService);

permissions.setPermissions(['user:view', 'user:create']);
permissions.can('user:view');
permissions.canAny(['user:create', 'user:update']);
permissions.canAll(['user:view', 'user:create']);
```

## Grouped sidebar menu

Convert the IAM `/menus/effective` response once:

```ts
const sidebarMenu = inject(SidebarMenuService);
sidebarMenu.setEffectiveMenu(response.data);
```

Import and render the standalone component:

```ts
import { Component } from '@angular/core';
import { SidebarMenuComponent } from '@suonpisey/auth-core';

@Component({
  standalone: true,
  imports: [SidebarMenuComponent],
  template: ` <auth-sidebar-menu title="Hanuman Portal" [collapsed]="sidebarCollapsed" /> `,
})
export class AppSidebarComponent {
  sidebarCollapsed = false;
}
```

The component reads `SidebarMenuService` automatically. It also accepts menu
items directly through `[items]`. Appearance can be customized with the
`--auth-sidebar-*` CSS custom properties.

## Source layout

```text
src/lib/
├── auth/
│   ├── config/
│   ├── interceptors/
│   ├── providers/
│   └── services/
├── navigation/
│   ├── components/
│   ├── models/
│   └── services/
├── permissions/
└── ui/
```

Feature folders expose their own barrel file, while `src/public-api.ts` remains
the only supported package entry point. Internal file paths are not public API.

## Develop

```bash
npm run build
npm test -- --watch=false
```

Build output is written to `dist/auth-core`.
