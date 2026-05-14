import { type Api } from '@lichess-org/chessground/api';
import { type Config } from '@lichess-org/chessground/config';

import { start3D } from './model3D/scene';

export function Chessground(element: HTMLElement, config?: Config): Api {
  return start3D(element, config || {});
}
