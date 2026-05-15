import * as THREE from 'three';
import { type OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { type PieceHoverController } from './hover';
import { clearMoveDestinationHighlights, updateMoveDestinationHighlights } from './moveDestinationHighlight';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

type DragState = {
  piece: THREE.Mesh;
  pointerId: number;
  startPosition: THREE.Vector3;
  startClientX: number;
  startClientY: number;
  pointerOffsetX: number;
  pointerOffsetZ: number;
  hasMoved: boolean;
};

type SetupPieceInteractionParams = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  hoverController: PieceHoverController;
  allowWhiteInteraction?: boolean;
  allowBlackInteraction?: boolean;
  onMoveAttempt?: (uci: string) => boolean; // Validate move in UCI form; return true if valid
};

export type PieceInteractionController = {
  moveProgrammatically: (fromX: number, fromZ: number, toX: number, toZ: number) => boolean;
  moveProgrammaticallyBySquare: (from: string, to: string) => boolean;
  setLastMoveSquares: (squares?: readonly string[]) => void;
  setAllowedMoveDests: (dests?: Map<string, readonly string[]>, showDests?: boolean) => void;
  setMoveAttemptCallback: (callback: (uci: string) => boolean) => void; // Set callback for validating user moves
  setAllowWhiteInteraction: (allow: boolean) => void;
  setAllowBlackInteraction: (allow: boolean) => void;
  setInteractionEnabled: (enabled: boolean) => void;
};

export function setupPieceInteraction({
  scene,
  camera,
  renderer,
  controls,
  hoverController,
  allowWhiteInteraction: initialAllowWhiteInteraction = true,
  allowBlackInteraction: initialAllowBlackInteraction = true,
}: SetupPieceInteractionParams): PieceInteractionController {
  const pointerRaycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const boardPoint = new THREE.Vector3();
  const dragThresholdPx = 4;
  const lastMoveFromHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff_e4_5c,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const lastMoveToHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff_e4_5c,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const selectableMoveHighlights = new THREE.Group();
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
  scene.add(selectableMoveHighlights);

  let dragState: DragState | null = null;
  let selectedPiece: THREE.Mesh | null = null;
  let activeMouseButton: number | null = null;
  let hoverDisabledForOrbit = false;
  let onMoveAttempt: ((uci: string) => boolean) | undefined = undefined;
  let allowWhiteInteraction = initialAllowWhiteInteraction;
  let allowBlackInteraction = initialAllowBlackInteraction;
  let interactionEnabled = true;
  let allowedMoveDests: Map<string, readonly string[]> | undefined;
  let showDests = true;

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

  function isWhitePiece(piece: THREE.Mesh): boolean {
    return piece.name === piece.name.toUpperCase();
  }

  function isOppositeColor(a: THREE.Mesh, b: THREE.Mesh): boolean {
    return isWhitePiece(a) !== isWhitePiece(b);
  }

  function canInteractWithPiece(piece: THREE.Mesh): boolean {
    return isWhitePiece(piece) ? allowWhiteInteraction : allowBlackInteraction;
  }

  hoverController.setPieceHighlightFilter(canInteractWithPiece);

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
    return coordinatesToSquare(fromX, fromZ) + coordinatesToSquare(toX, toZ);
  }

  function coordinatesToSquare(x: number, z: number): string {
    const fileIndex = Math.round(x + 3.5);
    const rank = Math.round(4.5 - z);
    return String.fromCharCode('a'.charCodeAt(0) + fileIndex) + rank;
  }

  function clearSelectableMoveHighlights() {
    clearMoveDestinationHighlights(selectableMoveHighlights);
  }

  function showSelectableMoveHighlights(piece: THREE.Mesh, fromSquareOverride?: string) {
    updateMoveDestinationHighlights(
      scene,
      selectableMoveHighlights,
      piece,
      showDests ? allowedMoveDests : undefined,
      fromSquareOverride,
    );
  }

  function setLastMoveHighlights(fromX: number, fromZ: number, toX: number, toZ: number) {
    lastMoveFromHighlight.position.x = fromX;
    lastMoveFromHighlight.position.z = fromZ;
    lastMoveToHighlight.position.x = toX;
    lastMoveToHighlight.position.z = toZ;
    lastMoveFromHighlight.visible = true;
    lastMoveToHighlight.visible = true;
  }

  function clearLastMoveHighlights() {
    lastMoveFromHighlight.visible = false;
    lastMoveToHighlight.visible = false;
  }

  function setLastMoveSquares(squares?: readonly string[]) {
    if (!squares || squares.length === 0) {
      clearLastMoveHighlights();
      return;
    }

    const from = parseSquare(squares[0]);
    if (!from) {
      clearLastMoveHighlights();
      return;
    }

    if (squares.length === 1) {
      lastMoveFromHighlight.visible = false;
      lastMoveToHighlight.position.x = from.x;
      lastMoveToHighlight.position.z = from.z;
      lastMoveToHighlight.visible = true;
      return;
    }

    const to = parseSquare(squares[1]);
    if (!to) {
      clearLastMoveHighlights();
      return;
    }

    setLastMoveHighlights(from.x, from.z, to.x, to.z);
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
    clearSelectableMoveHighlights();
  }

  function selectPiece(piece: THREE.Mesh) {
    if (!canInteractWithPiece(piece)) {
      return;
    }

    selectedPiece = piece;
    hoverController.setPinnedPiece(piece);
    showSelectableMoveHighlights(piece);
  }

  function applyMoveOrCapture(
    movingPiece: THREE.Mesh,
    targetX: number,
    targetZ: number,
    fromX = movingPiece.position.x,
    fromZ = movingPiece.position.z,
    validateWithCallback = true,
  ): boolean {
    // Validate move through callback if provided
    if (validateWithCallback && onMoveAttempt) {
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

  function setMoveAttemptCallback(callback: (uci: string) => boolean) {
    onMoveAttempt = callback;
  }

  function setAllowedMoveDests(dests?: Map<string, readonly string[]>, nextShowDests = true) {
    allowedMoveDests = dests;
    showDests = nextShowDests;
    if (selectedPiece) {
      showSelectableMoveHighlights(selectedPiece);
    } else {
      clearSelectableMoveHighlights();
    }
  }

  function setInteractionEnabled(enabled: boolean) {
    interactionEnabled = enabled;
    if (!interactionEnabled) {
      if (dragState) {
        dragState.piece.position.copy(dragState.startPosition);
        dragState.piece.position.y = dragState.startPosition.y;
        hoverController.setDraggedPiece(null);
        hoverController.setIgnoredPiece(null);
        if (renderer.domElement.hasPointerCapture(dragState.pointerId)) {
          renderer.domElement.releasePointerCapture(dragState.pointerId);
        }
        dragState = null;
      }
      clearSelection();
      hoverController.setEnabled(false);
      controls.enabled = true;
      return;
    }

    hoverController.setEnabled(true);
  }

  function setAllowWhiteInteraction(allow: boolean) {
    allowWhiteInteraction = allow;
    hoverController.setPieceHighlightFilter(canInteractWithPiece);
    if (selectedPiece && !canInteractWithPiece(selectedPiece)) {
      clearSelection();
    }
  }

  function setAllowBlackInteraction(allow: boolean) {
    allowBlackInteraction = allow;
    hoverController.setPieceHighlightFilter(canInteractWithPiece);
    if (selectedPiece && !canInteractWithPiece(selectedPiece)) {
      clearSelection();
    }
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

    const moved = applyMoveOrCapture(movingPiece, targetX, targetZ, sourceX, sourceZ, false);
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

      if (!canInteractWithPiece(targetPiece)) {
        return true;
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
    if (
      !hasBoardIntersection ||
      !isWithinBoard(boardPoint.x + dragState.pointerOffsetX, boardPoint.z + dragState.pointerOffsetZ)
    ) {
      return;
    }

    dragState.piece.position.x = boardPoint.x + dragState.pointerOffsetX;
    dragState.piece.position.z = boardPoint.z + dragState.pointerOffsetZ;
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
    if (hasBoardIntersection) {
      const dropX = boardPoint.x + dragState.pointerOffsetX;
      const dropZ = boardPoint.z + dragState.pointerOffsetZ;
      if (isWithinBoard(dropX, dropZ)) {
        const targetX = getSquareCoordinate(dropX);
        const targetZ = getSquareCoordinate(dropZ);
        dropApplied = applyMoveOrCapture(piece, targetX, targetZ, startPosition.x, startPosition.z);
      }
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

  renderer.domElement.addEventListener(
    'pointerdown',
    event => {
      if (!interactionEnabled) {
        return;
      }

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

      if (!canInteractWithPiece(piece)) {
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

      updatePointerNdc(event);
      pointerRaycaster.setFromCamera(pointerNdc, camera);
      const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;
      const pointerOffsetX = hasBoardIntersection ? piece.position.x - boardPoint.x : 0;
      const pointerOffsetZ = hasBoardIntersection ? piece.position.z - boardPoint.z : 0;

      dragState = {
        piece,
        pointerId: event.pointerId,
        startPosition: piece.position.clone(),
        startClientX: event.clientX,
        startClientY: event.clientY,
        pointerOffsetX,
        pointerOffsetZ,
        hasMoved: false,
      };
      controls.enabled = false;
      hoverController.setPinnedPiece(piece);
      hoverController.setIgnoredPiece(piece);
      hoverController.updateFromPointerEvent(event);
      renderer.domElement.setPointerCapture(event.pointerId);
    },
    { capture: true },
  );

  renderer.domElement.addEventListener('pointermove', event => {
    if (!interactionEnabled) {
      return;
    }

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

      const dragStartSquare = coordinatesToSquare(dragState.startPosition.x, dragState.startPosition.z);
      showSelectableMoveHighlights(dragState.piece, dragStartSquare);
      hoverController.setDraggedPiece(dragState.piece);
    }

    dragPieceToPointer(event);
  });

  renderer.domElement.addEventListener('pointerup', event => {
    if (!interactionEnabled) {
      return;
    }

    if (dragState && event.pointerId === dragState.pointerId) {
      finishDrag(event);
      return;
    }

    handleSelectedPieceClickTarget(event);
  });

  renderer.domElement.addEventListener('pointercancel', event => {
    if (!interactionEnabled) {
      return;
    }

    finishDrag(event);
  });

  renderer.domElement.addEventListener('pointerdown', event => {
    activeMouseButton = event.pointerType === 'mouse' ? event.button : null;
  });

  renderer.domElement.addEventListener('pointerup', () => {
    activeMouseButton = null;
  });

  renderer.domElement.addEventListener('pointercancel', () => {
    activeMouseButton = null;
  });

  controls.addEventListener('start', () => {
    if (!interactionEnabled) {
      return;
    }

    if (activeMouseButton === 0) {
      hoverController.setEnabled(false);
      hoverDisabledForOrbit = true;
    }
  });

  controls.addEventListener('end', () => {
    activeMouseButton = null;
    if (!interactionEnabled) {
      return;
    }

    if (hoverDisabledForOrbit) {
      hoverController.setEnabled(true);
      hoverDisabledForOrbit = false;
    }
  });

  return {
    moveProgrammatically,
    moveProgrammaticallyBySquare,
    setLastMoveSquares,
    setAllowedMoveDests,
    setMoveAttemptCallback,
    setAllowWhiteInteraction,
    setAllowBlackInteraction,
    setInteractionEnabled,
  };
}
