import { h } from 'snabbdom';

import type ChallengeCtrl from '../challenge';
import { type Renderer } from '../interfaces';
import { url } from '../routing';
import { spinner } from './loading';

import '../../scss/_challenge.scss';

export const renderChallenge: (ctrl: ChallengeCtrl) => Renderer = ctrl => _ => [
  h(
    'div.challenge-page',
    {
      hook: {
        destroy: ctrl.onUnmount,
      },
    },
    [
      h('div.challenge-page__awaiting', [spinner(), h('span.ms-3', 'Awaiting the opponent...')]),
      h(
        'a.btn.btn-secondary',
        {
          attrs: { href: url('/') },
        },
        'Cancel',
      ),
    ],
  ),
];
