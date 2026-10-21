// The menu's entries at the bottom of the screen (phone and TV), by route name; the others are at
// the top, in the order the drawer layout lists them.
const BOTTOM_ROUTE_NAMES: ReadonlySet<string> = new Set(['about', 'settings']);

// The drawer's routes in two groups, the top one and the bottom one, each in its order.
export function toMenuSections<Route extends Readonly<{ name: string }>>(
  routeList: readonly Route[],
): Readonly<{ bottomList: Route[]; topList: Route[] }> {
  return {
    bottomList: routeList.filter(({ name }) => BOTTOM_ROUTE_NAMES.has(name)),
    topList: routeList.filter(({ name }) => !BOTTOM_ROUTE_NAMES.has(name)),
  };
}
