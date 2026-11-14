import { useEffect, useState } from 'react';
import { ToastProvider } from './components/ui';
import { Home } from './screens/Home';
import { Setup } from './screens/Setup';
import { SessionScreen, type SessionTab } from './screens/SessionScreen';
import { actions, getState } from './state/store';
import { makeExampleSession } from './state/example';

export type Route =
  | { name: 'home' }
  | { name: 'setup'; fromId?: string }
  | { name: 'session'; id: string; tab: SessionTab };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'neu') return { name: 'setup', fromId: parts[1] };
  if (parts[0] === 's' && parts[1]) {
    const tab: SessionTab = parts[2] === 'statistik' ? 'stats' : parts[2] === 'abrechnung' ? 'money' : 'block';
    return { name: 'session', id: parts[1], tab };
  }
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'setup':
      return r.fromId ? `#/neu/${r.fromId}` : '#/neu';
    case 'session':
      return `#/s/${r.id}${r.tab === 'stats' ? '/statistik' : r.tab === 'money' ? '/abrechnung' : ''}`;
  }
}

export function navigate(r: Route, replace = false) {
  const h = href(r);
  if (replace) {
    try {
      history.replaceState(null, '', h);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    } catch {
      /* fall through */
    }
  }
  location.hash = h;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));

  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    // The single-file preview opens with an example evening so there is something to look at.
    if (__SINGLE__ && getState().sessions.length === 0) actions.createSession(makeExampleSession());
  }, []);

  return (
    <ToastProvider>
      {route.name === 'home' && <Home />}
      {route.name === 'setup' && <Setup fromId={route.fromId} />}
      {route.name === 'session' && <SessionScreen id={route.id} tab={route.tab} />}
    </ToastProvider>
  );
}
