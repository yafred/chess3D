import { init, attributesModule, eventListenersModule, classModule } from 'snabbdom';

import { Ctrl } from './ctrl';
import routing from './routing';

import '../scss/style.scss';
import 'bootstrap/dist/js/bootstrap.esm.js';

import view, { loadingBody } from './view/app';

export default async function startApp(element: HTMLElement) {
  const patch = init([attributesModule, eventListenersModule, classModule]);

  const ctrl = new Ctrl(redraw);

  let vnode = patch(element, loadingBody());

  function redraw() {
    vnode = patch(vnode, view(ctrl));
  }

  await ctrl.auth.init();
  routing(ctrl);
}

void startApp(document.body);
