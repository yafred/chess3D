import { type Key } from '@lichess-org/chessground/types';

import { type PieceInteractionController } from './interaction';

export function setupMoveAttemptAdapter(
  interactionController: PieceInteractionController,
  getAllowedMoveDests: () => Map<Key, readonly Key[]> | undefined,
  onMove?: (from: string, to: string, isPremove: boolean) => void,
  isFree?: () => boolean,
) {
  if (onMove) {
    interactionController.setMoveCallback(onMove);
  }

  interactionController.setMoveAttemptCallback(uci => {
    const from = uci.slice(0, 2) as Key;
    const to = uci.slice(2, 4) as Key;
    const allowedMoveDests = getAllowedMoveDests();

    if (!isFree?.() && allowedMoveDests && !allowedMoveDests.get(from)?.includes(to)) {
      return false;
    }

    return true;
  });
}
