import { routeDefinitions } from './routeCatalog';

export const navigationItems = routeDefinitions.filter((route) => !route.hiddenInSidebar);
