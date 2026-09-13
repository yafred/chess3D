import { type DrawBrushes, type DrawShape } from '@lichess-org/chessground/draw';
import * as THREE from 'three';

import { createArrowMesh, createCustomSvgMesh } from '../objects/createAutoShapes.js';
import { keyToCoordinates } from './interaction.js';

export function clearAutoShapes(group: THREE.Group) {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.MeshBasicMaterial && child.material.map) {
        child.material.map.dispose();
      }
      (child.material as THREE.Material).dispose();
    }
  }
  group.clear();
}

export function updateAutoShapes(group: THREE.Group, shapes: readonly DrawShape[], brushes: DrawBrushes) {
  clearAutoShapes(group);

  for (const shape of shapes) {
    const orig = keyToCoordinates(shape.orig);
    if (!orig) {
      continue;
    }

    if (shape.customSvg) {
      const customSvg = shape.customSvg as string | { html?: string };
      const html = typeof customSvg === 'string' ? customSvg : customSvg.html;
      if (html) {
        group.add(createCustomSvgMesh(orig.x, orig.z, html));
      }
      continue;
    }

    if (!shape.dest || !shape.brush) {
      continue;
    }

    const dest = keyToCoordinates(shape.dest);
    if (!dest) {
      continue;
    }

    const brush = brushes[shape.brush];
    if (!brush) {
      continue;
    }

    group.add(createArrowMesh(orig.x, orig.z, dest.x, dest.z, brush.color, brush.opacity));
  }
}
