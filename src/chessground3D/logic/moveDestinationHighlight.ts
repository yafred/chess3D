import * as THREE from 'three';

import { createMoveDestinationHighlightMarker } from '../objects/createMarkers.js';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

type ChessKey = string;

function getSquareCoordinate(value: number): number {
  return Math.round(value + 3.5) - 3.5;
}

function coordinatesToSquare(x: number, z: number): string {
  const fileIndex = Math.round(x + 3.5);
  const rank = Math.round(4.5 - z);
  return String.fromCharCode('a'.charCodeAt(0) + fileIndex) + rank;
}

function parseSquare(square: string): { x: number; z: number } | null {
  const normalized = square.trim().toLowerCase();
  if (!/^[a-h][1-8]$/.test(normalized)) {
    return null;
  }

  const fileIndex = normalized.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number.parseInt(normalized[1], 10);
  return {
    x: fileIndex - 3.5,
    z: 4.5 - rank,
  };
}

function getPieceAtSquare(
  scene: THREE.Scene,
  x: number,
  z: number,
  ignorePiece?: THREE.Mesh,
): THREE.Mesh | null {
  let pieceAtSquare: THREE.Mesh | null = null;

  scene.traverse(obj => {
    if (pieceAtSquare || !(obj instanceof THREE.Mesh) || !pieceCodes.has(obj.name) || obj === ignorePiece) {
      return;
    }

    if (Math.abs(obj.position.x - x) < 0.001 && Math.abs(obj.position.z - z) < 0.001) {
      pieceAtSquare = obj;
    }
  });

  return pieceAtSquare;
}

export function clearMoveDestinationHighlights(highlightGroup: THREE.Group) {
  highlightGroup.clear();
}

export function updateMoveDestinationHighlights(
  scene: THREE.Scene,
  highlightGroup: THREE.Group,
  selectedPiece: THREE.Mesh | null,
  allowedMoveDests?: Map<ChessKey, readonly ChessKey[]>,
) {
  clearMoveDestinationHighlights(highlightGroup);
  if (!selectedPiece) {
    return;
  }

  const fromSquare = coordinatesToSquare(
    getSquareCoordinate(selectedPiece.position.x),
    getSquareCoordinate(selectedPiece.position.z),
  );
  const destinationSquares = allowedMoveDests?.get(fromSquare);
  if (!destinationSquares?.length) {
    return;
  }

  for (const square of destinationSquares) {
    const coordinates = parseSquare(square);
    if (!coordinates) {
      continue;
    }

    const occupyingPiece = getPieceAtSquare(scene, coordinates.x, coordinates.z, selectedPiece);
    const marker = createMoveDestinationHighlightMarker(!!occupyingPiece);
    marker.position.x = coordinates.x;
    marker.position.z = coordinates.z;
    highlightGroup.add(marker);
  }
}
