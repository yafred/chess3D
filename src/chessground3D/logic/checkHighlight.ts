import { type Key } from '@lichess-org/chessground/types';
import * as THREE from 'three';

import { keyToCoordinates } from './interaction.js';

type ChessColor = 'white' | 'black';

function getCheckedColor(check: ChessColor | boolean | undefined, turnColor: ChessColor | undefined) {
  if (!check) {
    return undefined;
  }
  if (check === true) {
    return turnColor;
  }
  return check;
}

export function updateCheckHighlight(
  scene: THREE.Scene,
  marker: THREE.Mesh,
  square: Key | undefined,
  highlightCheck: boolean,
) {
  const checkedSquare = square ? keyToCoordinates(square) : undefined;

  if (checkedSquare && highlightCheck) {
    marker.position.x = checkedSquare.x;
    marker.position.z = checkedSquare.z;
    marker.visible = true;
  } else {
    marker.visible = false;
  }
}
