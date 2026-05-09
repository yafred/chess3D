import { Chessground } from '@lichess-org/chessground';
import type { Config as CgConfig } from '@lichess-org/chessground/config';
import { Color } from 'chessops';
import { h, VNode } from 'snabbdom';

import { BoardCtrl } from '../game';
import { start3D } from '../model3D/scene';

export const renderBoard = (ctrl: BoardCtrl) =>
  h(
    'div.game-page__board',
    h('div.cg-wrap', {
      hook: {
        insert(vnode) {
          const element = vnode.elm as HTMLElement;
          const config = ctrl.chessgroundConfig();
          const model3DConfig = (config as CgConfig & { model3D?: { sceneAssetUrl?: string } }).model3D;

          if (model3DConfig?.sceneAssetUrl) {
            ctrl.setGround(start3D(element, config as CgConfig));
            return;
          }

          ctrl.setGround(Chessground(element, config));
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
        turn: ctrl.chess.turn == color,
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
