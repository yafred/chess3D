import { type Color, type Role } from '@lichess-org/chessground/types';
import { opposite } from '@lichess-org/chessground/util';
import { h } from 'snabbdom';

import { type GameCtrl } from '../game';
import { type Renderer } from '../interfaces';
import { renderBoard, renderPlayer } from './board';

import '../../scss/_game.scss';
import { clockContent } from './clock';

export const renderGame: (ctrl: GameCtrl) => Renderer = ctrl => _ => [
  h(
    `div.game-page.game-page--${ctrl.game.id}`,
    {
      hook: {
        destroy: ctrl.onUnmount,
      },
    },
    [
      h('aside.game-page__left-float', [
        renderGamePlayer(ctrl, opposite(ctrl.pov)),
        renderGamePlayer(ctrl, ctrl.pov),
        ctrl.playing() ? renderButtons(ctrl) : renderState(ctrl),
        h('div.promotion', [
          h('label', { attrs: { for: 'promotion-select' } }, 'Promotion'),
          h(
            'select#promotion-select',
            {
              on: {
                change(e) {
                  const value = (e.target as HTMLSelectElement).value.toLowerCase();
                  ctrl.setPromotionRole(value as Role);
                },
              },
            },
            ['Queen', 'Rook', 'Bishop', 'Knight'].map(key =>
              h(
                'option',
                {
                  attrs: {
                    value: key.toLowerCase(),
                    selected: key === ctrl.promotionRole,
                  },
                },
                key,
              ),
            ),
          ),
        ]),
      ]),
      renderBoard(ctrl),
    ],
  ),
];

const renderButtons = (ctrl: GameCtrl) =>
  h('div.btn-group.mt-4', [
    h(
      'button.btn.btn-secondary',
      {
        attrs: { type: 'button', disabled: !ctrl.playing() },
        on: {
          click() {
            if (confirm('Confirm?')) {
              ctrl.resign();
            }
          },
        },
      },
      ctrl.chess.fullmoves > 1 ? 'Resign' : 'Abort',
    ),
  ]);

const renderState = (ctrl: GameCtrl) => h('div.game-page__state', ctrl.game.state.status);

const renderGamePlayer = (ctrl: GameCtrl, color: Color) => {
  const p = ctrl.game[color];
  const clock = clockContent(
    ctrl.timeOf(color),
    color === ctrl.chess.turn && ctrl.chess.fullmoves > 1 && ctrl.playing()
      ? ctrl.lastUpdateAt - Date.now()
      : 0,
  );
  return renderPlayer(ctrl, color, clock, p.name, p.title, p.rating, p.aiLevel);
};
