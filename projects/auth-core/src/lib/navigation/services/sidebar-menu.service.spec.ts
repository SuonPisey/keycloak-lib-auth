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

  it('resolves a client token without encoding it into the route', () => {
    const service = new SidebarMenuService();

    const [item] = service.setEffectiveMenu([
      {
        title: 'New Incident',
        path: '${hb-ui-it}/it/helpdesk/sites',
        clientId: 'hb-api-dms',
      },
    ]);

    expect(item.clientId).toBe('hb-ui-it');
    expect(item.state).toBe('it/helpdesk/sites');
  });
});
