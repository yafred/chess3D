import { type State } from '@lichess-org/chessground/state';
import type * as THREE from 'three';

import { updateCheckHighlight } from './logic/checkHighlight.js';
import { piecesToScene, sceneToFen } from './logic/fen.js';
import { createPieceHoverController } from './logic/hover.js';
import { setupPieceInteraction } from './logic/interaction.js';
import { applyInteractionPolicy } from './logic/interactionPolicy.js';
import { setupMoveAttemptAdapter } from './logic/moveAttemptAdapter.js';
import { createA1Marker, createCheckHighlightMarker, createH8Marker } from './objects/createMarkers.js';
import { createPieceTemplates } from './objects/createPieceTemplates.js';
import { createCamera } from './scene/createCamera.js';
import { createLights } from './scene/createLights.js';
import { createRenderer } from './scene/createRenderer.js';
import { createScene } from './scene/createScene.js';
import { createControls, getWhiteAzimuthAngle, setControlsOrientation } from './systems/controls.js';
import { registerSceneRenderStep } from './systems/renderScheduler.js';
import { handleResize } from './systems/resize.js';

const SCENE_ASSET_URL =
  window.location.port === '9663'
    ? new URL('/assets/scene.glb', window.location.origin).href // use with lila development env
    : new URL('./public/scene.glb', import.meta.url).href; // use in chess3D

type ChessColor = 'white' | 'black';
type ChessKey = string;

export interface ChessScene {
  set(state: State, hasFen?: boolean): void;
  move(from: ChessKey, to: ChessKey): void;
  getFen(): string;
  destroy(): void;
}

export function createChessScene(sceneRoot: HTMLElement, state: State): ChessScene {
  const scene = createScene();
  const camera = createCamera(sceneRoot);
  const renderer = createRenderer(sceneRoot);
  const controls = createControls(camera, renderer.domElement);
  const lights = createLights();
  scene.add(lights);
  const a1Marker = createA1Marker();
  const h8Marker = createH8Marker();
  const checkHighlight = createCheckHighlightMarker();
  scene.add(a1Marker);
  scene.add(h8Marker);
  scene.add(checkHighlight);
  handleResize(sceneRoot, camera, renderer);

  let materialTemplates = new Map<string, THREE.Material>();
  let pieceTemplates = new Map<string, THREE.Mesh>();
  let isDestroyed = false;
  let currentOrientation: ChessColor | undefined;
  let isViewOnly = !!state.viewOnly;

  const whiteAzimuthAngle = getWhiteAzimuthAngle(controls);
  function setOrientation(orientation: ChessColor | undefined) {
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

  let allowedMoveDests = state.movable.dests;
  let showDests = state.movable.showDests;
  type MoveEventCallback = NonNullable<State['events']['move']>;
  type MoveAfterCallback = NonNullable<State['movable']['events']['after']>;
  let currentMoveHandler: MoveEventCallback | undefined = state.events?.move;
  let currentAfterMoveHandler: MoveAfterCallback | undefined = state.movable?.events?.after;

  function notifyMove(from: string, to: string) {
    currentMoveHandler?.(from as any, to as any);
    currentAfterMoveHandler?.(from as any, to as any, { premove: false });
  }

  setupMoveAttemptAdapter(interactionController, () => allowedMoveDests, notifyMove);

  function setAllowInteractionForColors(state: Pick<State, 'turnColor' | 'movable'>) {
    applyInteractionPolicy(interactionController, {
      isViewOnly,
      turnColor: state.turnColor,
      movableColor: state.movable?.color,
    });
  }

  function applyState(nextState: State, hasFen = true) {
    interactionController.setLastMoveSquares(nextState.highlight.lastMove ? nextState.lastMove : undefined);
    if (hasFen) {
      piecesToScene(nextState.pieces, scene, pieceTemplates, materialTemplates);
    }
    updateCheckHighlight(checkHighlight, nextState.check, nextState.highlight.check);

    allowedMoveDests = nextState.movable.dests;
    showDests = nextState.movable.showDests;
    interactionController.setAllowedMoveDests(allowedMoveDests, showDests);
    currentMoveHandler = nextState.events?.move;
    currentAfterMoveHandler = nextState.movable?.events?.after;

    isViewOnly = !!nextState.viewOnly;
    setOrientation(nextState.orientation);
    setAllowInteractionForColors(nextState);
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

  // API implementation
  return {
    set(state, hasFen = true) {
      applyState(state, hasFen);
    },

    move(from, to) {
      interactionController.moveProgrammaticallyBySquare(from, to);
    },

    getFen() {
      return sceneToFen(scene);
    },

    destroy() {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;

      unregisterRenderStep();
      renderer.dispose();
      controls.dispose();
      sceneRoot.removeEventListener('pointermove', hoverController.updateFromPointerEvent);
    },
  };
}
