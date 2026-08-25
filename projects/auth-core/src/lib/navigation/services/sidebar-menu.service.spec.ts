import { SidebarMenuService } from './sidebar-menu.service';

describe('SidebarMenuService', () => {
  it('maps nested IAM menus to sidebar groups', () => {
    const service = new SidebarMenuService();

    const menu = service.setEffectiveMenu([
      {
        id: 1,
        title: 'Administration',
        path: '/administration',
        icon: 'settings',
        badge: 2,
        children: [{ id: 2, title: 'Users', path: '/administration/users' }],
      },
    ]);

    expect(menu).toEqual([
      expect.objectContaining({
        id: 1,
        name: 'Administration',
        state: 'administration',
        type: 'dropDown',
        badges: [{ color: 'primary', value: '2' }],
        sub: [
          expect.objectContaining({
            id: 2,
            name: 'Users',
            state: 'administration/users',
            type: 'link',
          }),
        ],
      }),
    ]);
  });

  it('handles an empty response', () => {
    const service = new SidebarMenuService();

    expect(service.setEffectiveMenu(undefined)).toEqual([]);
    expect(service.getMenuItems()).toEqual([]);
  });

  it('extracts a target client from a variable-prefixed path', () => {
    const service = new SidebarMenuService();

    const menu = service.setEffectiveMenu([
      {
        id: 150,
        clientId: 'hb-api-dms',
        title: 'Sponsorship',
        path: '/sponsorships',
        children: [
          {
            id: 149,
            clientId: 'hb-api-dms',
            title: 'List Request',
            path: '${hb-ui-hr}/hr/leave/my-leave-request',
          },
        ],
      },
    ]);

    expect(menu[0].sub?.[0]).toEqual(
      expect.objectContaining({
        clientId: 'hb-ui-hr',
        state: 'hr/leave/my-leave-request',
      }),
    );
  });

  it('extracts a target client when the path has leading whitespace', () => {
    const service = new SidebarMenuService();

    const menu = service.setEffectiveMenu([
      {
        title: 'List Request',
        clientId: 'hb-api-dms',
        path: '  ${hb-ui-hr}/hr/leave/my-leave-request',
      },
    ]);

    expect(menu[0]).toEqual(
      expect.objectContaining({
        clientId: 'hb-ui-hr',
        state: 'hr/leave/my-leave-request',
      }),
    );
  });

  it.each(['hb-ui-hr', 'hb-ui-it', 'hb-ui-general', 'hb-internal-it'])(
    'maps a data-driven link for %s',
    (clientId) => {
      const service = new SidebarMenuService();

      const menu = service.setEffectiveMenu([
        {
          title: 'Application link',
          clientId: 'hb-api-navigation',
          path: `\${${clientId}}/dashboard`,
        },
      ]);

      expect(menu[0]).toEqual(
        expect.objectContaining({
          clientId,
          state: 'dashboard',
        }),
      );
    },
  );
});
