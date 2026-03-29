import * as THREE from 'three';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);
const hoverTintScalar = 0.5;
const pinnedTintScalar = 0.7;

type HighlightMode = 'hover' | 'pinned';

export type PieceHoverController = {
  updateFromPointerEvent: (event: PointerEvent) => void;
  update: () => void;
  setEnabled: (enabled: boolean) => void;
  setPinnedPiece: (piece: THREE.Mesh | null) => void;
  setIgnoredPiece: (piece: THREE.Mesh | null) => void;
};

function getColorMaterial(mesh: THREE.Mesh): (THREE.Material & { color: THREE.Color }) | null {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return null;
  }

  const candidate = material as THREE.Material & { color?: unknown };
  return candidate.color instanceof THREE.Color
    ? (material as THREE.Material & { color: THREE.Color })
    : null;
}

function getPieceMeshFromObject(object: THREE.Object3D | null): THREE.Mesh | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current instanceof THREE.Mesh && pieceCodes.has(current.name)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

function getPieceAtSquare(scene: THREE.Scene, x: number, z: number): THREE.Mesh | null {
  let pieceAtSquare: THREE.Mesh | null = null;
  scene.traverse((obj) => {
    if (pieceAtSquare || !(obj instanceof THREE.Mesh) || !pieceCodes.has(obj.name)) {
      return;
    }

    if (Math.abs(obj.position.x - x) < 0.001 && Math.abs(obj.position.z - z) < 0.001) {
      pieceAtSquare = obj;
    }
  });

  return pieceAtSquare;
}

export function createPieceHoverController(
  scene: THREE.Scene,
  camera: THREE.Camera,
  domElement: HTMLElement,
): PieceHoverController {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const boardPoint = new THREE.Vector3();
  let enabled = true;
  let hasPointerPosition = false;
  let hovered: THREE.Mesh | null = null;
  let hoveredMode: HighlightMode | null = null;
  let pinnedPiece: THREE.Mesh | null = null;
  let ignoredPiece: THREE.Mesh | null = null;
  const squareHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf7e27f,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  squareHighlight.rotation.x = -Math.PI / 2;
  squareHighlight.position.y = 0.01;
  squareHighlight.visible = false;
  squareHighlight.renderOrder = 10;
  scene.add(squareHighlight);

  function clearHoveredState() {
    if (hovered) {
      const hoveredMaterial = getColorMaterial(hovered);
      if (hoveredMaterial && hovered.userData.originalColor instanceof THREE.Color) {
        hoveredMaterial.color.copy(hovered.userData.originalColor);
      }
      hovered = null;
      hoveredMode = null;
    }
    squareHighlight.visible = false;
  }

  function highlightPiece(piece: THREE.Mesh, mode: HighlightMode) {
    if (hovered === piece && hoveredMode === mode) {
      return;
    }

    clearHoveredState();
    const material = getColorMaterial(piece);
    if (!material) {
      return;
    }

    hovered = piece;
    hoveredMode = mode;
    hovered.userData.originalColor = material.color.clone();
    const tintScalar = mode === 'pinned' ? pinnedTintScalar : hoverTintScalar;
    material.color.copy(hovered.userData.originalColor).multiplyScalar(tintScalar);
  }

  return {
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (!enabled) {
        if (pinnedPiece && hovered === pinnedPiece) {
          squareHighlight.visible = false;
        } else {
          clearHoveredState();
        }
      }
    },
    setPinnedPiece(piece: THREE.Mesh | null) {
      pinnedPiece = piece;
      if (!pinnedPiece) {
        clearHoveredState();
        return;
      }

      highlightPiece(pinnedPiece, 'pinned');
    },
    setIgnoredPiece(piece: THREE.Mesh | null) {
      ignoredPiece = piece;
    },
    updateFromPointerEvent(event: PointerEvent) {
      const rect = domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      hasPointerPosition = true;
    },
    update() {
      if (!enabled) {
        return;
      }

      // Avoid highlighting a square at startup before any pointer input exists.
      if (!hasPointerPosition) {
        clearHoveredState();
        return;
      }

      if (pinnedPiece && !pinnedPiece.parent) {
        pinnedPiece = null;
        clearHoveredState();
      }

      raycaster.setFromCamera(mouse, camera);
      let targetPiece: THREE.Mesh | null = null;
      let hasHighlightedSquare = false;

      const hits = raycaster.intersectObjects(scene.children, true);

      let hitPiece: THREE.Mesh | null = null;
      for (const intersection of hits) {
        const candidate = getPieceMeshFromObject(intersection.object);
        if (candidate && ignoredPiece && candidate === ignoredPiece) {
          continue;
        }
        if (candidate) {
          hitPiece = candidate;
          break;
        }
      }

      if (hitPiece) {
        squareHighlight.position.x = hitPiece.position.x;
        squareHighlight.position.z = hitPiece.position.z;
        squareHighlight.visible = true;
        hasHighlightedSquare = true;
        targetPiece = hitPiece;
      } else {
        const hasBoardIntersection = raycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;
        if (hasBoardIntersection && Math.abs(boardPoint.x) <= 4 && Math.abs(boardPoint.z) <= 4) {
          squareHighlight.position.x = Math.round(boardPoint.x + 3.5) - 3.5;
          squareHighlight.position.z = Math.round(boardPoint.z + 3.5) - 3.5;
          squareHighlight.visible = true;
          hasHighlightedSquare = true;
          targetPiece = getPieceAtSquare(scene, squareHighlight.position.x, squareHighlight.position.z);
        } else {
          squareHighlight.visible = false;
        }
      }

      if (pinnedPiece) {
        highlightPiece(pinnedPiece, 'pinned');
        return;
      }

      if (hovered && hovered !== targetPiece) {
        clearHoveredState();
      }

      if (!hasHighlightedSquare || !targetPiece || hovered === targetPiece) {
        return;
      }

      highlightPiece(targetPiece, 'hover');
    },
  };
}