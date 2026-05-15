import { type Api } from '@lichess-org/chessground/api';
import { type Config } from '@lichess-org/chessground/config';

import { createChessScene } from './chessScene';

export function Chessground(element: HTMLElement, config?: Config): Api {
  const scene = createChessScene(element, config || {});

  function notImplemented(name: string): () => void;
  function notImplemented<T>(name: string, returnValue: T): () => T;
  function notImplemented<T>(name: string, returnValue?: T) {
    return () => {
      console.warn(`${name} is not implemented in this 3D scene.`);
      return returnValue;
    };
  }

  return {
    state: {} as any,

    set(config) {
      scene.set(config);
    },

    getFen: notImplemented('getFen', ''),
    toggleOrientation: notImplemented('toggleOrientation'),
    move: notImplemented('move'),
    setPieces: notImplemented('setPieces'),
    selectSquare: notImplemented('selectSquare'),
    newPiece: notImplemented('newPiece'),
    cancelMove: notImplemented('cancelMove'),
    stop: notImplemented('stop'),
    explode: notImplemented('explode'),
    setShapes: notImplemented('setShapes'),
    setAutoShapes: notImplemented('setAutoShapes'),
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
