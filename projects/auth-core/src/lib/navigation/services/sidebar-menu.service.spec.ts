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
});
