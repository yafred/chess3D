import { type Api } from '@lichess-org/chessground/api';
import { type Config, configure } from '@lichess-org/chessground/config';
import { defaults, type HeadlessState, type State } from '@lichess-org/chessground/state';

import { createChessScene } from './chessScene';

export function Chessground(element: HTMLElement, config?: Config): Api {
  function notImplemented(name: string): () => void;
  function notImplemented<T>(name: string, returnValue: T): () => T;
  function notImplemented<T>(name: string, returnValue?: T) {
    return () => {
      console.warn(`${name} is not implemented in this 3D scene.`);
      return returnValue;
    };
  }

  const maybeState: HeadlessState = defaults();
  configure(maybeState, config || {});
  const state = maybeState as State;

  element.innerHTML = '';
  element.classList.add('cg-wrap');
  const container = document.createElement('cg-container');
  element.appendChild(container);
  const scene = createChessScene(container, state);
  state.events.insert?.({ board: container, container, wrap: element });

  return {
    state: state,

    set(config) {
      configure(state, config);
      scene.set(state, 'fen' in config);
    },

    getFen() {
      return scene.getFen();
    },
    toggleOrientation: notImplemented('toggleOrientation'),
    move(orig, dest) {
      scene.move(orig, dest);
    },
    setPieces: notImplemented('setPieces'),
    selectSquare(key, _force): void {
      scene.selectSquare(key);
    },
    newPiece: notImplemented('newPiece'),
    cancelMove: notImplemented('cancelMove'),
    stop: notImplemented('stop'),
    explode: notImplemented('explode'),
    setShapes: notImplemented('setShapes'),
    setAutoShapes(shapes) {
      scene.setAutoShapes(shapes);
    },
    dragNewPiece: notImplemented('dragNewPiece'),
    redrawAll: notImplemented('redrawAll'),
    playPremove: notImplemented('playPremove', false),
    cancelPremove: notImplemented('cancelPremove'),
    playPredrop: notImplemented('playPredrop', false),
    cancelPredrop: notImplemented('cancelPredrop'),
    getKeyAtDomPos: notImplemented('getKeyAtDomPos', undefined),

    destroy() {
      scene.destroy();
    },
  };
}
