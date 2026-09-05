import { type Color } from '@lichess-org/chessground/types';

type InteractionPermissionController = {
  setInteractionEnabled: (enabled: boolean) => void;
  setAllowWhiteInteraction: (allow: boolean) => void;
  setAllowBlackInteraction: (allow: boolean) => void;
};

type InteractionPolicyConfig = {
  isViewOnly: boolean;
  turnColor?: Color;
  movableColor?: Color | 'both';
};

export function applyInteractionPolicy(
  interactionController: InteractionPermissionController,
  config: InteractionPolicyConfig,
) {
  interactionController.setInteractionEnabled(!config.isViewOnly);
  if (config.isViewOnly) {
    interactionController.setAllowWhiteInteraction(false);
    interactionController.setAllowBlackInteraction(false);
    return;
  }

  if (!config.turnColor) {
    return;
  }

  const isWhiteTurn = config.turnColor === 'white';
  const isMyTurn =
    (isWhiteTurn && config.movableColor === 'white') ||
    (!isWhiteTurn && config.movableColor === 'black') ||
    config.movableColor === 'both';

  interactionController.setAllowWhiteInteraction(isWhiteTurn && isMyTurn);
  interactionController.setAllowBlackInteraction(!isWhiteTurn && isMyTurn);
}
