import { type PieceInteractionController } from './interaction';

export function setupMoveAttemptAdapter(
  interactionController: PieceInteractionController,
  getAllowedMoveDests: () => Map<string, readonly string[]> | undefined,
  onMove?: (from: string, to: string) => void,
) {
  if (!onMove) {
    return;
  }

  interactionController.setMoveAttemptCallback(uci => {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const allowedMoveDests = getAllowedMoveDests();

    if (allowedMoveDests && !allowedMoveDests.get(from)?.includes(to)) {
      return false;
    }

    onMove(from, to);
    return true;
  });
}
