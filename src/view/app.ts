import { h, type VNode } from 'snabbdom';

import { type Ctrl } from '../ctrl';
import { type Renderer } from '../interfaces';
import { renderChallenge } from './challenge';
import { renderGame } from './game';
import { renderHome } from './home';
import layout from './layout';
import { renderPuzzle } from './puzzle';
import { renderSeek } from './seek';
import { spinner } from './spinner';
import { renderTv } from './tv';

export default function view(ctrl: Ctrl): VNode {
  return layout(ctrl, selectRenderer(ctrl)(ctrl));
}

const selectRenderer = (ctrl: Ctrl): Renderer => {
  if (ctrl.page === 'puzzle') {
    return ctrl.puzzle ? renderPuzzle(ctrl.puzzle) : renderLoading;
  }
  if (ctrl.page === 'game') {
    return ctrl.game ? renderGame(ctrl.game) : renderLoading;
  }
  if (ctrl.page === 'home') {
    return renderHome;
  }
  if (ctrl.page === 'seek' && ctrl.seek) {
    return renderSeek(ctrl.seek);
  }
  if (ctrl.page === 'challenge' && ctrl.challenge) {
    return renderChallenge(ctrl.challenge);
  }
  if (ctrl.page === 'tv') {
    return ctrl.tv ? renderTv(ctrl.tv) : renderLoading;
  }
  return renderNotFound;
};

const renderLoading: Renderer = _ => [loadingBody()];

const renderNotFound: Renderer = _ => [h('h1', 'Not found')];

export const loadingBody = () => h('div.loading', spinner());
