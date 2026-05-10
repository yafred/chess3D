import { type Role } from '@lichess-org/chessground/types';
import { h } from 'snabbdom';

import { type Renderer } from '../interfaces';
import { type PuzzleCtrl } from '../puzzle';

import '../../scss/_puzzle.scss';
import { renderBoard } from './board';

export const renderPuzzle: (ctrl: PuzzleCtrl) => Renderer = ctrl => _ => [
  h(`div.game-page.game-page`, [h('aside.game-page__left-float', [renderButtons(ctrl)]), renderBoard(ctrl)]),
];

const renderButtons = (ctrl: PuzzleCtrl) =>
  h('div.d-flex.flex-column.gap-2.mt-4', [
    h(
      'button.btn.btn-secondary',
      {
        attrs: { type: 'button' },
        on: {
          click() {
            ctrl.dailyPuzzle();
          },
        },
      },
      'daily puzzle',
    ),
    h('div.input-group', [
      h('input.form-control', {
        attrs: {
          type: 'text',
          placeholder: 'Puzzle theme',
          value: ctrl.puzzleTheme,
        },
        on: {
          input(event: Event) {
            ctrl.setPuzzleTheme((event.target as HTMLInputElement).value);
          },
        },
      }),
      h(
        'button.btn.btn-secondary',
        {
          attrs: { type: 'button' },
          on: {
            click() {
              ctrl.nextPuzzle();
            },
          },
        },
        'next puzzle',
      ),
    ]),
    h('div.input-group', [
      h('input.form-control', {
        attrs: {
          type: 'text',
          placeholder: 'Puzzle ID',
          value: ctrl.puzzleId,
        },
        on: {
          input(event: Event) {
            ctrl.setPuzzleId((event.target as HTMLInputElement).value);
          },
        },
      }),
      h(
        'button.btn.btn-secondary',
        {
          attrs: { type: 'button' },
          on: {
            click() {
              const id = ctrl.puzzleId.trim();
              if (id) {
                ctrl.puzzleById(id);
              }
            },
          },
        },
        'load puzzle',
      ),
    ]),
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
  ]);
