import { Chessground } from 'chessground3D';
import { type Color } from 'chessops';
import { h, type VNode } from 'snabbdom';

import { type BoardCtrl } from '../game';

// scene.glb is copied to assets/ by the vite plugin (see vite.config.mts)
const sceneUrl = new URL(`${import.meta.env.BASE_URL}assets/scene.glb`, document.baseURI).href;

export const renderBoard = (ctrl: BoardCtrl) =>
  h(
    'div.game-page__board',
    h('div.cg-wrap', {
      hook: {
        insert(vnode) {
          ctrl.setGround(Chessground(vnode.elm as HTMLElement, ctrl.chessgroundConfig(), sceneUrl));
        },
      },
    }),
  );

export const renderPlayer = (
  ctrl: BoardCtrl,
  color: Color,
  clock: VNode,
  name: string,
  title?: string,
  rating?: number,
  aiLevel?: number,
) => {
  return h(
    'div.game-page__player',
    {
      class: {
        turn: ctrl.chess.turn === color,
      },
    },
    [
      h('div.game-page__player__user', [
        title && h('span.game-page__player__user__title.display-5', title),
        h(
          'span.game-page__player__user__name.display-5',
          aiLevel ? `Stockfish level ${aiLevel}` : name || 'Anon',
        ),
        h('span.game-page__player__user__rating', rating || ''),
      ]),
      h('div.game-page__player__clock.display-6', clock),
    ],
  );
};
