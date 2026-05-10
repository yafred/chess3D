import { Chessground } from '@lichess-org/chessground';
import { h } from 'snabbdom';

import { Ctrl } from '../ctrl';
import { Game, Renderer } from '../interfaces';
import OngoingGames from '../ongoingGames';
import { href } from '../routing';

export const renderHome: Renderer = ctrl => (ctrl.auth.me ? userHome(ctrl) : anonHome());

const userHome = (ctrl: Ctrl) => [
  h('div', [
    h('div.btn-group.mt-5', [
      h(
        'button.btn.btn-outline-primary.btn-lg',
        {
          attrs: { type: 'button' },
          on: { click: ctrl.openPuzzle },
        },
        'Puzzles',
      ),
      h(
        'button.btn.btn-outline-primary.btn-lg',
        {
          attrs: { type: 'button' },
          on: { click: ctrl.playAi },
        },
        'Play the Lichess AI',
      ),
      h(
        'button.btn.btn-outline-primary.btn-lg',
        {
          attrs: { type: 'button' },
          on: { click: () => ctrl.playMaia(10, 0) },
        },
        'Play a casual 10+0 game with the maia1 BOT',
      ),
    ]),
    h('h2.mt-5.mb-3', 'About'),
    renderAbout(),
    h('h2.mt-5', 'Games in progress'),
    h('p', 'Start a game on Lichess, it will appear here.'),
    h('div.games', renderGames(ctrl.games)),
  ]),
];
const renderGames = (ongoing: OngoingGames) =>
  ongoing.games.length ? ongoing.games.map(renderGameWidget) : [h('p', 'No ongoing games at the moment.')];

const renderGameWidget = (game: Game) =>
  h(
    `a.game-widget.text-decoration-none.game-widget--${game.id}`,
    {
      attrs: href(`/game/${game.gameId}`),
    },
    [
      h('span.game-widget__opponent', [
        h('span.game-widget__opponent__name', game.opponent.username || 'Anon'),
        game.opponent.rating && h('span.game-widget__opponent__rating', game.opponent.rating),
      ]),
      h(
        'span.game-widget__board.cg-wrap',
        {
          hook: {
            insert(vnode) {
              const el = vnode.elm as HTMLElement;
              Chessground(el, {
                fen: game.fen,
                orientation: game.color,
                lastMove: game.lastMove.match(/.{1,2}/g),
                viewOnly: true,
                movable: { free: false },
                drawable: { visible: false },
                coordinates: false,
              });
            },
          },
        },
        'board',
      ),
    ],
  );

const anonHome = () => [
  h('div.login.text-center', [
    renderAbout(),
    h('div.big', [h('p', 'Please log in to continue.')]),
    h(
      'a.btn.btn-primary.btn-lg.mt-5',
      {
        attrs: href('/login'),
      },
      'Login with Lichess',
    ),
  ]),
];

const renderAbout = () =>
  h('div.about', [
    h('p', [
      'Play on ',
      h(
        'a',
        {
          attrs: { href: 'https://lichess.org' },
        },
        'Lichess',
      ),
      ' using a 3D model and the Lichess public API.',
    ]),
    h('p', [
      h(
        'a',
        {
          attrs: { href: 'https://github.com/yafred/lichess3D/tree/chess3D' },
        },
        "See how it's built on GitHub",
      ),
    ]),
  ]);
