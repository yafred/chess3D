import { type Key } from '@lichess-org/chessground/types';
import * as THREE from 'three';

import { keyToCoordinates } from './interaction.js';

export function updateCheckHighlight(marker: THREE.Mesh, square: Key | undefined, highlightCheck: boolean) {
  const checkedSquare = square ? keyToCoordinates(square) : undefined;

  if (checkedSquare && highlightCheck) {
    marker.position.x = checkedSquare.x;
    marker.position.z = checkedSquare.z;
    marker.visible = true;
  } else {
    marker.visible = false;
  }
}
