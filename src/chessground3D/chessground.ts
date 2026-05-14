import { type Api } from '@lichess-org/chessground/api';
import { type Config } from '@lichess-org/chessground/config';

import { createChessScene } from './chessScene';

export function Chessground(element: HTMLElement, config?: Config): Api {
  const scene = createChessScene(element, config || {});

  const notImplemented = (name: string) => () => {
    console.warn(`${name} is not implemented in this 3D scene.`);
  };

  return {
    state: {} as any,

    set(config) {
      scene.set(config);
    },

    getFen() {
      console.warn('Getting FEN from the 3D scene is not implemented.');
      return '';
    },

    toggleOrientation() {
      console.warn('Toggling orientation is not implemented in this 3D scene.');
    },

    move: notImplemented('move') as Api['move'],
    setPieces: notImplemented('setPieces') as Api['setPieces'],
    selectSquare: notImplemented('selectSquare') as Api['selectSquare'],
    newPiece: notImplemented('newPiece') as Api['newPiece'],
    cancelMove: notImplemented('cancelMove') as Api['cancelMove'],
    stop: notImplemented('stop') as Api['stop'],
    explode: notImplemented('explode') as Api['explode'],
    setShapes: notImplemented('setShapes') as Api['setShapes'],
    setAutoShapes: notImplemented('setAutoShapes') as Api['setAutoShapes'],
    dragNewPiece: notImplemented('dragNewPiece') as Api['dragNewPiece'],
    redrawAll: notImplemented('redrawAll') as Api['redrawAll'],

    playPremove() {
      console.warn('Premoves are not supported in this 3D scene.');
      return false;
    },

    cancelPremove() {
      console.warn('Premoves are not supported in this 3D scene.');
    },

    playPredrop(_validate) {
      console.warn('Predrops are not supported in this 3D scene.');
      return false;
    },

    cancelPredrop() {
      console.warn('Predrops are not supported in this 3D scene.');
    },

    getKeyAtDomPos(_pos) {
      console.warn('Getting key at DOM position is not implemented in this 3D scene.');
      return undefined;
    },

    destroy() {
      scene.destroy();
    },
  };
}
