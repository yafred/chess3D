import { type Color } from '@lichess-org/chessground/types';

type InteractionPermissionController = {
  setInteractionEnabled: (enabled: boolean) => void;
  setAllowWhiteInteraction: (allow: boolean) => void;
  setAllowBlackInteraction: (allow: boolean) => void;
  setDraggable: (enabled: boolean) => void;
  setSelectable: (enabled: boolean) => void;
};

type InteractionPolicyConfig = {
  isViewOnly: boolean;
  turnColor?: Color;
  movableColor?: Color | 'both';
  draggable: boolean;
  selectable: boolean;
  premovableEnabled: boolean;
};

export function applyInteractionPolicy(
  interactionController: InteractionPermissionController,
  config: InteractionPolicyConfig,
) {
  interactionController.setInteractionEnabled(!config.isViewOnly);
  interactionController.setDraggable(config.draggable && !config.isViewOnly);
  interactionController.setSelectable(config.selectable && !config.isViewOnly);
  if (config.isViewOnly) {
    interactionController.setAllowWhiteInteraction(false);
    interactionController.setAllowBlackInteraction(false);
    return;
  }

  if (!config.turnColor) {
    return;
  }

  const isWhiteTurn = config.turnColor === 'white';
  const canMoveWhite = config.movableColor === 'white' || config.movableColor === 'both';
  const canMoveBlack = config.movableColor === 'black' || config.movableColor === 'both';

  // premoves are only meaningful for a single fixed color (not 'both', which can always move)
  const canPremoveWhite = config.premovableEnabled && config.movableColor === 'white' && !isWhiteTurn;
  const canPremoveBlack = config.premovableEnabled && config.movableColor === 'black' && isWhiteTurn;

  interactionController.setAllowWhiteInteraction((isWhiteTurn && canMoveWhite) || canPremoveWhite);
  interactionController.setAllowBlackInteraction((!isWhiteTurn && canMoveBlack) || canPremoveBlack);
}
