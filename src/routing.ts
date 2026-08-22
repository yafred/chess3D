import page from 'page';

import { type Ctrl } from './ctrl';

export default function Routing(ctrl: Ctrl) {
  normalizeHashbangFragment();
  page.base(BASE_PATH);
  const openSpectate = (id: string) => {
    void ctrl.watchGame(id);
  };
  page('/', async ctx => {
    if (ctx.path !== '/') {
      return;
    }
    if (ctx.querystring.includes('code=liu_')) {
      history.pushState({}, '', BASE_PATH || '/');
    }
    ctrl.openHome();
  });
  page('/login', async _ => {
    if (ctrl.auth.me) {
      return page('/');
    }
    await ctrl.auth.login();
  });
  page('/logout', async _ => {
    await ctrl.auth.logout();
    location.href = BASE_PATH;
  });
  page('/game/:id', ctx => {
    ctrl.openGame(ctx.params.id);
  });
  page('/tv', ctx => ctrl.watchTv());
  page('/spectate/:id', ctx => {
    openSpectate(ctx.params.id);
  });
  // Some hashbang navigations are parsed as /!/path instead of /path.
  page('/!/spectate/:id', ctx => {
    openSpectate(ctx.params.id);
  });
  // Keep an encoded fallback to tolerate externally encoded fragments.
  page('/%21/spectate/:id', ctx => {
    openSpectate(ctx.params.id);
  });
  page({ hashbang: true });
  dispatchDirectHashbangSpectate(ctrl);
  // Some browsers/navigation layers mutate hash fragments without triggering page.js routes.
  // Bridge hash changes to route dispatch explicitly.
  window.addEventListener('hashchange', () => {
    if (dispatchDirectHashbangSpectate(ctrl)) {
      return;
    }

    const hashbangPath = readHashbangPath();
    if (!hashbangPath) {
      return;
    }

    const canonicalHash = `#!${hashbangPath}`;
    if (location.hash !== canonicalHash) {
      history.replaceState({}, '', `${location.pathname}${location.search}${canonicalHash}`);
    }

    page.show(hashbangPath);
  });
}

const normalizeHashbangFragment = () => {
  const hash = location.hash;
  if (!hash || hash.startsWith('#!/')) {
    return;
  }

  const decoded = decodeURIComponent(hash.slice(1));
  if (decoded.startsWith('!/')) {
    history.replaceState({}, '', `${location.pathname}${location.search}#${decoded}`);
  }
};

const readHashbangPath = () => {
  if (!location.hash) {
    return undefined;
  }

  const decoded = decodeURIComponent(location.hash.slice(1));
  if (decoded.startsWith('!/')) {
    return decoded.slice(1);
  }

  return undefined;
};

const dispatchDirectHashbangSpectate = (ctrl: Ctrl) => {
  const hashbangPath = readHashbangPath();
  if (!hashbangPath) {
    return false;
  }

  const match = hashbangPath.match(/^\/spectate\/([a-zA-Z0-9]+)$/);
  if (!match) {
    return false;
  }

  void ctrl.watchGame(match[1]);
  return true;
};

export const BASE_PATH = location.pathname.replace(/\/$/, '');

export const url = (path: string) => `${BASE_PATH}${path}`;
export const href = (path: string) => ({ href: url(path) });
