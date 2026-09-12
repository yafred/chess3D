import { type Api } from '@lichess-org/chessground/api';
import { type Config, configure } from '@lichess-org/chessground/config';
import { defaults, type HeadlessState, type State } from '@lichess-org/chessground/state';
import { type PiecesDiff } from '@lichess-org/chessground/types';
import { opposite } from '@lichess-org/chessground/util';

import { createChessScene } from './chessScene';
import { dragNewPiece } from './drag';

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
  const elements = { board: container, container, wrap: element };
  state.events.insert?.(elements);
  state.dom = {
    redraw: () => {},
    redrawNow: () => {},
    unbind: () => {},
    elements: elements,
    bounds: Object.assign(() => element.getBoundingClientRect(), {
      clear() {},
    }),
  };

  let cancelNewPieceDrag: (() => void) | undefined;

  return {
    state: state,

    set(config) {
      configure(state, config);
      scene.set(state, 'fen' in config);
    },

    getFen() {
      return scene.getFen();
    },
    toggleOrientation() {
      state.orientation = opposite(state.orientation);
      state.animation.current = state.draggable.current = state.selected = undefined;
      scene.selectSquare(null);
      scene.set(state, false);
    },
    move(orig, dest) {
      scene.move(orig, dest);
    },
    setPieces(pieces: PiecesDiff) {
      for (const [key, piece] of pieces) {
        if (piece) state.pieces.set(key, piece);
        else state.pieces.delete(key);
      }
      scene.set(state);
    },
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
    dragNewPiece(piece, event, force) {
      cancelNewPieceDrag?.();
      cancelNewPieceDrag = dragNewPiece(state, scene, piece, event, force);
    },
    redrawAll: notImplemented('redrawAll'),
    playPremove() {
      return scene.playPremove();
    },
    cancelPremove() {
      scene.cancelPremove();
    },
    playPredrop: notImplemented('playPredrop', false),
    cancelPredrop: notImplemented('cancelPredrop'),
    getKeyAtDomPos(pos) {
      return scene.getKeyAtDomPos(pos);
    },

    destroy() {
      cancelNewPieceDrag?.();
      scene.destroy();
    },
  };
}
