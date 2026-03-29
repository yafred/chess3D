import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PieceHoverController } from './hover';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

type DragState = {
  piece: THREE.Mesh;
  pointerId: number;
  startPosition: THREE.Vector3;
};

type SetupPieceInteractionParams = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  hoverController: PieceHoverController;
};

export function setupPieceInteraction({
  scene,
  camera,
  renderer,
  controls,
  hoverController,
}: SetupPieceInteractionParams) {
  const pointerRaycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const boardPoint = new THREE.Vector3();

  let dragState: DragState | null = null;
  let activeMouseButton: number | null = null;
  let hoverDisabledForOrbit = false;

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

  function updatePointerNdc(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function getSquareCoordinate(value: number): number {
    return Math.round(value + 3.5) - 3.5;
  }

  function isWithinBoard(x: number, z: number): boolean {
    return Math.abs(x) <= 4 && Math.abs(z) <= 4;
  }

  function getPieceAtSquare(x: number, z: number, ignorePiece?: THREE.Mesh): THREE.Mesh | null {
    let pieceAtSquare: THREE.Mesh | null = null;

    scene.traverse((obj) => {
      if (pieceAtSquare || !(obj instanceof THREE.Mesh) || !pieceCodes.has(obj.name) || obj === ignorePiece) {
        return;
      }

      if (Math.abs(obj.position.x - x) < 0.001 && Math.abs(obj.position.z - z) < 0.001) {
        pieceAtSquare = obj;
      }
    });

    return pieceAtSquare;
  }

  function isWhitePiece(piece: THREE.Mesh): boolean {
    return piece.name === piece.name.toUpperCase();
  }

  function isOppositeColor(a: THREE.Mesh, b: THREE.Mesh): boolean {
    return isWhitePiece(a) !== isWhitePiece(b);
  }

  function getPieceUnderPointer(event: PointerEvent): THREE.Mesh | null {
    updatePointerNdc(event);
    pointerRaycaster.setFromCamera(pointerNdc, camera);
    const hits = pointerRaycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      const piece = getPieceMeshFromObject(hit.object);
      if (piece) {
        return piece;
      }
    }

    return null;
  }

  function dragPieceToPointer(event: PointerEvent) {
    if (!dragState) {
      return;
    }

    updatePointerNdc(event);
    pointerRaycaster.setFromCamera(pointerNdc, camera);
    const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;
    if (!hasBoardIntersection || !isWithinBoard(boardPoint.x, boardPoint.z)) {
      return;
    }

    dragState.piece.position.x = boardPoint.x;
    dragState.piece.position.z = boardPoint.z;
    dragState.piece.position.y = dragState.startPosition.y + 0.2;
  }

  function finishDrag(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const { piece, startPosition } = dragState;

    updatePointerNdc(event);
    pointerRaycaster.setFromCamera(pointerNdc, camera);
    const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;

    let dropApplied = false;
    if (hasBoardIntersection && isWithinBoard(boardPoint.x, boardPoint.z)) {
      const targetX = getSquareCoordinate(boardPoint.x);
      const targetZ = getSquareCoordinate(boardPoint.z);
      const occupyingPiece = getPieceAtSquare(targetX, targetZ, piece);

      if (!occupyingPiece) {
        piece.position.set(targetX, startPosition.y, targetZ);
        dropApplied = true;
      } else if (isOppositeColor(piece, occupyingPiece)) {
        scene.remove(occupyingPiece);
        piece.position.set(targetX, startPosition.y, targetZ);
        dropApplied = true;
      }
    }

    if (!dropApplied) {
      piece.position.copy(startPosition);
    }

    piece.position.y = startPosition.y;
    dragState = null;
    controls.enabled = true;
    hoverController.setEnabled(true);

    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    const piece = getPieceUnderPointer(event);
    if (!piece) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragState = {
      piece,
      pointerId: event.pointerId,
      startPosition: piece.position.clone(),
    };
    controls.enabled = false;
    hoverController.setEnabled(false);
    renderer.domElement.setPointerCapture(event.pointerId);
    dragPieceToPointer(event);
  }, { capture: true });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    dragPieceToPointer(event);
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    finishDrag(event);
  });

  renderer.domElement.addEventListener('pointercancel', (event) => {
    finishDrag(event);
  });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    activeMouseButton = event.pointerType === 'mouse' ? event.button : null;
  });

  renderer.domElement.addEventListener('pointerup', () => {
    activeMouseButton = null;
  });

  renderer.domElement.addEventListener('pointercancel', () => {
    activeMouseButton = null;
  });

  controls.addEventListener('start', () => {
    if (activeMouseButton === 0) {
      hoverController.setEnabled(false);
      hoverDisabledForOrbit = true;
    }
  });

  controls.addEventListener('end', () => {
    activeMouseButton = null;
    if (hoverDisabledForOrbit) {
      hoverController.setEnabled(true);
      hoverDisabledForOrbit = false;
    }
  });
}
