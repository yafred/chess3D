import { type DrawBrushes, type DrawShape } from '@lichess-org/chessground/draw';
import * as THREE from 'three';

import { createArrowMesh } from '../objects/createAutoShapes.js';
import { keyToCoordinates } from './interaction.js';

export function clearAutoShapes(group: THREE.Group) {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
  group.clear();
}

export function updateAutoShapes(group: THREE.Group, shapes: readonly DrawShape[], brushes: DrawBrushes) {
  clearAutoShapes(group);

  for (const shape of shapes) {
    if (!shape.dest || !shape.brush) {
      continue;
    }

    const orig = keyToCoordinates(shape.orig);
    const dest = keyToCoordinates(shape.dest);
    if (!orig || !dest) {
      continue;
    }

    const brush = brushes[shape.brush];
    if (!brush) {
      continue;
    }

    group.add(createArrowMesh(orig.x, orig.z, dest.x, dest.z, brush.color, brush.opacity));
  }
}
