import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PieceHoverController } from './hover';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

type DragState = {
  piece: THREE.Mesh;
  pointerId: number;
  startPosition: THREE.Vector3;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
};

type SetupPieceInteractionParams = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  hoverController: PieceHoverController;
  onMoveAttempt?: (uci: string) => boolean; // Validate move in UCI form; return true if valid
};

export type PieceInteractionController = {
  moveProgrammatically: (fromX: number, fromZ: number, toX: number, toZ: number) => boolean;
  moveProgrammaticallyBySquare: (from: string, to: string) => boolean;
};

export function setupPieceInteraction({
  scene,
  camera,
  renderer,
  controls,
  hoverController,
  onMoveAttempt,
}: SetupPieceInteractionParams): PieceInteractionController {
  const pointerRaycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const boardPoint = new THREE.Vector3();
  const dragThresholdPx = 4;
  const lastMoveFromHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffe45c,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const lastMoveToHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffe45c,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  lastMoveFromHighlight.rotation.x = -Math.PI / 2;
  lastMoveToHighlight.rotation.x = -Math.PI / 2;
  lastMoveFromHighlight.position.y = 0.005;
  lastMoveToHighlight.position.y = 0.006;
  lastMoveFromHighlight.visible = false;
  lastMoveToHighlight.visible = false;
  lastMoveFromHighlight.renderOrder = 8;
  lastMoveToHighlight.renderOrder = 9;
  scene.add(lastMoveFromHighlight);
  scene.add(lastMoveToHighlight);

  let dragState: DragState | null = null;
  let selectedPiece: THREE.Mesh | null = null;
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

  function coordinatesToUci(fromX: number, fromZ: number, toX: number, toZ: number): string {
    // Convert board coordinates to square notation (a1-h8)
    const coordToSquare = (x: number, z: number) => {
      const fileIndex = Math.round(x + 3.5);
      const rank = Math.round(4.5 - z);
      return String.fromCharCode('a'.charCodeAt(0) + fileIndex) + rank;
    };
    return coordToSquare(fromX, fromZ) + coordToSquare(toX, toZ);
  }

  function setLastMoveHighlights(fromX: number, fromZ: number, toX: number, toZ: number) {
    lastMoveFromHighlight.position.x = fromX;
    lastMoveFromHighlight.position.z = fromZ;
    lastMoveToHighlight.position.x = toX;
    lastMoveToHighlight.position.z = toZ;
    lastMoveFromHighlight.visible = true;
    lastMoveToHighlight.visible = true;
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

  function clearSelection() {
    selectedPiece = null;
    hoverController.setPinnedPiece(null);
  }

  function selectPiece(piece: THREE.Mesh) {
    selectedPiece = piece;
    hoverController.setPinnedPiece(piece);
  }

  function applyMoveOrCapture(
    movingPiece: THREE.Mesh,
    targetX: number,
    targetZ: number,
    fromX = movingPiece.position.x,
    fromZ = movingPiece.position.z,
  ): boolean {
    // Validate move through callback if provided
    if (onMoveAttempt) {
      const normalizedFromX = getSquareCoordinate(fromX);
      const normalizedFromZ = getSquareCoordinate(fromZ);
      const uci = coordinatesToUci(normalizedFromX, normalizedFromZ, targetX, targetZ);
      if (!onMoveAttempt(uci)) {
        return false; // Move rejected by validation callback
      }
    }

    const fromSquareX = getSquareCoordinate(fromX);
    const fromSquareZ = getSquareCoordinate(fromZ);
    const occupyingPiece = getPieceAtSquare(targetX, targetZ, movingPiece);
    if (!occupyingPiece) {
      movingPiece.position.set(targetX, movingPiece.position.y, targetZ);
      setLastMoveHighlights(fromSquareX, fromSquareZ, targetX, targetZ);
      return true;
    }

    if (!isOppositeColor(movingPiece, occupyingPiece)) {
      return false;
    }

    scene.remove(occupyingPiece);
    movingPiece.position.set(targetX, movingPiece.position.y, targetZ);
    setLastMoveHighlights(fromSquareX, fromSquareZ, targetX, targetZ);
    return true;
  }

  function moveProgrammatically(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (dragState) {
      return false;
    }

    const sourceX = getSquareCoordinate(fromX);
    const sourceZ = getSquareCoordinate(fromZ);
    const targetX = getSquareCoordinate(toX);
    const targetZ = getSquareCoordinate(toZ);
    if (!isWithinBoard(sourceX, sourceZ) || !isWithinBoard(targetX, targetZ)) {
      return false;
    }

    const movingPiece = getPieceAtSquare(sourceX, sourceZ);
    if (!movingPiece) {
      return false;
    }

    const moved = applyMoveOrCapture(movingPiece, targetX, targetZ, sourceX, sourceZ);
    if (!moved) {
      return false;
    }

    clearSelection();
    return true;
  }

  function moveProgrammaticallyBySquare(from: string, to: string): boolean {
    const source = parseSquare(from);
    const target = parseSquare(to);
    if (!source || !target) {
      return false;
    }

    return moveProgrammatically(source.x, source.z, target.x, target.z);
  }

  function handleSelectedPieceClickTarget(event: PointerEvent): boolean {
    if (!selectedPiece || event.button !== 0) {
      return false;
    }

    updatePointerNdc(event);
    pointerRaycaster.setFromCamera(pointerNdc, camera);

    const targetPiece = getPieceUnderPointer(event);
    if (targetPiece) {
      if (targetPiece === selectedPiece) {
        clearSelection();
        return true;
      }

      if (isOppositeColor(selectedPiece, targetPiece)) {
        const targetX = targetPiece.position.x;
        const targetZ = targetPiece.position.z;
        if (applyMoveOrCapture(selectedPiece, targetX, targetZ)) {
          clearSelection();
          return true;
        }
      }

      selectPiece(targetPiece);
      return true;
    }

    const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;
    if (!hasBoardIntersection || !isWithinBoard(boardPoint.x, boardPoint.z)) {
      return false;
    }

    const targetX = getSquareCoordinate(boardPoint.x);
    const targetZ = getSquareCoordinate(boardPoint.z);
    if (applyMoveOrCapture(selectedPiece, targetX, targetZ)) {
      clearSelection();
    }

    return true;
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

    if (!dragState.hasMoved) {
      piece.position.copy(startPosition);
      piece.position.y = startPosition.y;
      dragState = null;
      hoverController.setDraggedPiece(null);
      hoverController.setIgnoredPiece(null);
      controls.enabled = true;
      hoverController.setEnabled(true);

      if (selectedPiece === piece) {
        clearSelection();
      } else {
        selectPiece(piece);
      }

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }

      return;
    }

    updatePointerNdc(event);
    pointerRaycaster.setFromCamera(pointerNdc, camera);
    const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;

    let dropApplied = false;
    if (hasBoardIntersection && isWithinBoard(boardPoint.x, boardPoint.z)) {
      const targetX = getSquareCoordinate(boardPoint.x);
      const targetZ = getSquareCoordinate(boardPoint.z);
      dropApplied = applyMoveOrCapture(piece, targetX, targetZ, startPosition.x, startPosition.z);
    }

    if (!dropApplied) {
      piece.position.copy(startPosition);
    }

    piece.position.y = startPosition.y;
    hoverController.setDraggedPiece(null);
    clearSelection();
    dragState = null;
    hoverController.setIgnoredPiece(null);
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
      if (selectedPiece) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // If a piece is pinned, clicking another piece should act as a click target,
    // not start a drag on the clicked piece.
    if (selectedPiece && piece !== selectedPiece) {
      event.preventDefault();
      event.stopPropagation();

      if (isOppositeColor(selectedPiece, piece)) {
        const targetX = piece.position.x;
        const targetZ = piece.position.z;
        if (applyMoveOrCapture(selectedPiece, targetX, targetZ)) {
          clearSelection();
          return;
        }
      }

      selectPiece(piece);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragState = {
      piece,
      pointerId: event.pointerId,
      startPosition: piece.position.clone(),
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
    };
    controls.enabled = false;
    hoverController.setIgnoredPiece(piece);
    hoverController.updateFromPointerEvent(event);
    renderer.domElement.setPointerCapture(event.pointerId);
  }, { capture: true });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    hoverController.updateFromPointerEvent(event);

    if (!dragState.hasMoved) {
      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      const movement = Math.hypot(deltaX, deltaY);
      if (movement < dragThresholdPx) {
        return;
      }

      dragState.hasMoved = true;
      if (selectedPiece === dragState.piece) {
        clearSelection();
      }
      hoverController.setDraggedPiece(dragState.piece);
    }

    dragPieceToPointer(event);
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    if (dragState && event.pointerId === dragState.pointerId) {
      finishDrag(event);
      return;
    }

    handleSelectedPieceClickTarget(event);
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

  return {
    moveProgrammatically,
    moveProgrammaticallyBySquare,
  };
}
