import { type Color } from '@lichess-org/chessground/types';
import { opposite } from '@lichess-org/chessground/util';
import { h } from 'snabbdom';

import { type Renderer } from '../interfaces';
import type SpectateCtrl from '../spectate';
import { renderBoard, renderPlayer } from './board';
import { clockContent } from './clock';

export const renderSpectate: (ctrl: SpectateCtrl) => Renderer = ctrl => _ => [
  h(
    `div.game-page.game-page--${ctrl.game.id}`,
    {
      hook: {
        destroy: ctrl.onUnmount,
      },
    },
    [
      h('aside.game-page__left-float', [
        renderSpectatePlayer(ctrl, opposite(ctrl.game.orientation)),
        renderSpectatePlayer(ctrl, ctrl.game.orientation),
      ]),
      renderBoard(ctrl),
    ],
  ),
];

const renderSpectatePlayer = (ctrl: SpectateCtrl, color: Color) => {
  const p = ctrl.player(color);
  const clock = clockContent(
    p.seconds && p.seconds * 1000,
    color === ctrl.chess.turn ? ctrl.lastUpdateAt - Date.now() : 0,
  );
  return renderPlayer(ctrl, color, clock, p.user.name, p.user.title, p.rating);
};
