// A tiny module-level store so the sidebar can show a red dot on a menu item
// when there are notifications of a matching kind. The Topbar already fetches
// the notification logs for the bell/panel; it publishes the active kinds here
// and the Sidebar subscribes, so there is no second /wa/logs fetch and the dots
// stay in step when notifications are cleared or deleted.
import type { NotificationLog } from "@/lib/api";

type Kind = NotificationLog["kind"];

let activeKinds: Kind[] = [];
const listeners = new Set<() => void>();

export function publishNotificationKinds(kinds: Kind[]) {
  activeKinds = kinds;
  listeners.forEach((fn) => fn());
}

export function getNotificationKinds() {
  return activeKinds;
}

export function subscribeNotificationKinds(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
