import { h } from 'snabbdom';

export const spinner = () =>
  h(
    'div.spinner-border.text-primary',
    { attrs: { role: 'status' } },
    h('span.visually-hidden', 'Loading...'),
  );
