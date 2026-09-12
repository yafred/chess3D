import { type State } from '@lichess-org/chessground/state';
import { type MouchEvent, type Piece } from '@lichess-org/chessground/types';
import { eventPosition } from '@lichess-org/chessground/util';

import { type ChessScene } from './chessScene';

export function dragNewPiece(
  state: State,
  scene: ChessScene,
  piece: Piece,
  event: MouchEvent,
  force = false,
): () => void {
  let position = eventPosition(event);
  const onMove = (moveEvent: Event) => {
    position = eventPosition(moveEvent as MouchEvent) ?? position;
  };
  const onEnd = (endEvent: Event) => {
    const dropPosition = eventPosition(endEvent as MouchEvent) ?? position;
    const key = dropPosition ? scene.getKeyAtDomPos(dropPosition) : undefined;
    if (key && (force || !state.pieces.has(key))) {
      state.pieces.set(key, piece);
      state.events.dropNewPiece?.(piece, key);
      state.movable.events?.afterNewPiece?.(piece.role, key, { premove: false, predrop: false });
      scene.set(state);
      state.events.change?.();
    }
    cancel();
  };
  const cancel = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove);
  document.addEventListener('mouseup', onEnd, { once: true });
  document.addEventListener('touchend', onEnd, { once: true });

  return cancel;
}
