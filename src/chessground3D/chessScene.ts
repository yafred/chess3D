import { type DrawShape } from '@lichess-org/chessground/draw';
import { write as fenWrite } from '@lichess-org/chessground/fen';
import { premove } from '@lichess-org/chessground/premove';
import { type State } from '@lichess-org/chessground/state';
import { type Color, type Key } from '@lichess-org/chessground/types';
import * as THREE from 'three';

import { updateAutoShapes } from './logic/autoShapes.js';
import { updateCheckHighlight } from './logic/checkHighlight.js';
import { createPieceHoverController } from './logic/hover.js';
import { setupPieceInteraction } from './logic/interaction.js';
import { applyInteractionPolicy } from './logic/interactionPolicy.js';
import { setupMoveAttemptAdapter } from './logic/moveAttemptAdapter.js';
import { createA1Marker, createCheckHighlightMarker, createH8Marker } from './objects/createMarkers.js';
import { piecesToScene } from './objects/createPieces.js';
import { createPieceTemplates } from './objects/createPieceTemplates.js';
import { createCamera } from './scene/createCamera.js';
import { createLights } from './scene/createLights.js';
import { createRenderer } from './scene/createRenderer.js';
import { createScene } from './scene/createScene.js';
import { createControls, getWhiteAzimuthAngle, setControlsOrientation } from './systems/controls.js';
import { registerSceneRenderStep } from './systems/renderScheduler.js';
import { handleResize } from './systems/resize.js';

const SCENE_ASSET_URL = new URL('/assets/scene.glb', window.location.origin).href // hardcoded for lila

export interface ChessScene {
  set(state: State, hasFen?: boolean): void;
  move(from: Key, to: Key): void;
  selectSquare(key: Key | null): void;
  setAutoShapes(shapes: DrawShape[]): void;
  getFen(): string;
  getKeyAtDomPos(pos: [number, number]): Key | undefined;
  playPremove(): boolean;
  cancelPremove(): void;
  destroy(): void;
}

export function createChessScene(sceneRoot: HTMLElement, state: State): ChessScene {
  const scene = createScene();
  const camera = createCamera(sceneRoot);
  const renderer = createRenderer(sceneRoot);
  const controls = createControls(camera, renderer.domElement);
  const pointerRaycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const boardPoint = new THREE.Vector3();
  const lights = createLights();
  scene.add(lights);
  const a1Marker = createA1Marker();
  const h8Marker = createH8Marker();
  const checkHighlight = createCheckHighlightMarker();
  const autoShapesGroup = new THREE.Group();
  scene.add(a1Marker);
  scene.add(h8Marker);
  scene.add(checkHighlight);
  scene.add(autoShapesGroup);
  const stopHandlingResize = handleResize(sceneRoot, camera, renderer);

  let materialTemplates = new Map<string, THREE.Material>();
  let pieceTemplates = new Map<string, THREE.Mesh>();
  let isDestroyed = false;
  let currentOrientation: Color | undefined;

  const whiteAzimuthAngle = getWhiteAzimuthAngle(controls);
  function setOrientation(orientation: Color | undefined) {
    if (!orientation || orientation === currentOrientation) {
      return;
    }
    setControlsOrientation(camera, controls, orientation, whiteAzimuthAngle);

    currentOrientation = orientation;
  }

  setOrientation(state.orientation);

  // Set up piece hover and interaction
  const hoverController = createPieceHoverController(scene, camera, renderer.domElement);
  sceneRoot.addEventListener('pointermove', hoverController.updateFromPointerEvent);

  // Set up interactions
  const interactionController = setupPieceInteraction({
    scene,
    camera,
    renderer,
    controls,
    hoverController,
  });

  function notifyMove(from: string, to: string, isPremove: boolean) {
    const orig = from as Key;
    const dest = to as Key;
    const piece = state.pieces.get(orig);
    const capturedPiece = state.pieces.get(dest);
    if (piece) {
      state.pieces.set(dest, piece);
      state.pieces.delete(orig);
      state.lastMove = [orig, dest];
      state.check = undefined;
    }

    state.events?.move?.(orig, dest, capturedPiece);
    state.movable?.events?.after?.(orig, dest, { premove: isPremove, captured: capturedPiece });
    state.events?.change?.();
  }

  setupMoveAttemptAdapter(
    interactionController,
    () => state.movable.dests,
    notifyMove,
    () => state.movable.free ?? false,
  );

  interactionController.setPremoveCallbacks({
    onSet: (orig, dest) => {
      state.premovable.current = [orig, dest];
      state.premovable.events?.set?.(orig, dest);
    },
    onUnset: () => {
      state.premovable.current = undefined;
      state.premovable.events?.unset?.();
    },
  });

  // premove destinations for every piece of the non-moving color, mirroring board.ts's `premove()` usage
  function computePremoveDests(s: State): Map<Key, readonly Key[]> | undefined {
    if (!s.premovable.enabled) {
      return undefined;
    }

    const dests = new Map<Key, readonly Key[]>();
    for (const key of s.pieces.keys()) {
      const keyDests = s.premovable.customDests?.get(key) ?? premove(s, key);
      if (keyDests.length > 0) {
        dests.set(key, keyDests);
      }
    }
    return dests;
  }

  function setAllowInteractionForColors(state: State) {
    applyInteractionPolicy(interactionController, {
      isViewOnly: state.viewOnly,
      turnColor: state.turnColor,
      movableColor: state.movable?.color,
      draggable: state.draggable.enabled,
      selectable: state.selectable.enabled,
      premovableEnabled: state.premovable.enabled,
    });
  }

  function applyState(s: State, hasFen = true) {
    interactionController.setLastMoveSquares(s.highlight.lastMove ? s.lastMove : undefined);
    if (hasFen) {
      piecesToScene(s.pieces, scene, pieceTemplates, materialTemplates);
    }
    updateCheckHighlight(checkHighlight, s.check, s.highlight.check);

    interactionController.setTurnColor(s.turnColor);
    interactionController.setMovableColor(s.movable.color);
    interactionController.setAllowedMoveDests(s.movable.dests, s.movable.showDests);
    interactionController.setPremoveDests(computePremoveDests(s), s.premovable.showDests);

    setOrientation(s.orientation);
    setAllowInteractionForColors(s);
  }

  // Load scene and templates (pieces and materials)
  void createPieceTemplates(scene, SCENE_ASSET_URL).then(
    ({ pieceTemplates: loadedPieces, materialTemplates: loadedMaterials }) => {
      pieceTemplates = loadedPieces;
      materialTemplates = loadedMaterials;

      applyState(state);

      scene.visible = true;
    },
  );

  const renderStep = () => {
    hoverController.update();
    controls.update();
    renderer.render(scene, camera);
  };
  const unregisterRenderStep = registerSceneRenderStep(renderStep);

  function coordinatesToSquare(x: number, z: number): Key {
    const fileIndex = Math.round(x + 3.5);
    const rank = Math.round(4.5 - z);
    return (String.fromCharCode('a'.charCodeAt(0) + fileIndex) + rank) as Key;
  }

  // API implementation
  return {
    set(state, hasFen = true) {
      applyState(state, hasFen);
    },

    move(from, to) {
      interactionController.moveProgrammaticallyBySquare(from, to);
    },

    selectSquare(key) {
      interactionController.selectSquare(key);
    },

    setAutoShapes(shapes) {
      updateAutoShapes(autoShapesGroup, shapes, state.drawable.brushes);
    },

    getFen() {
      return fenWrite(state.pieces);
    },

    getKeyAtDomPos(pos) {
      const rect = sceneRoot.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return undefined;
      }

      pointerNdc.x = ((pos[0] - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((pos[1] - rect.top) / rect.height) * 2 + 1;
      pointerRaycaster.setFromCamera(pointerNdc, camera);
      const hasBoardIntersection = pointerRaycaster.ray.intersectPlane(boardPlane, boardPoint) !== null;
      if (!hasBoardIntersection) {
        return undefined;
      }

      const boardX = boardPoint.x;
      const boardZ = boardPoint.z;
      if (Math.abs(boardX) > 4 || Math.abs(boardZ) > 4) {
        return undefined;
      }

      const squareX = Math.round(boardX + 3.5) - 3.5;
      const squareZ = Math.round(boardZ + 3.5) - 3.5;
      if (Math.abs(squareX) > 4 || Math.abs(squareZ) > 4) {
        return undefined;
      }

      return coordinatesToSquare(squareX, squareZ);
    },

    playPremove() {
      return interactionController.playQueuedPremove();
    },

    cancelPremove() {
      interactionController.cancelQueuedPremove();
    },

    destroy() {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;

      unregisterRenderStep();
      stopHandlingResize();
      renderer.dispose();
      controls.dispose();
      sceneRoot.removeEventListener('pointermove', hoverController.updateFromPointerEvent);
    },
  };
}
