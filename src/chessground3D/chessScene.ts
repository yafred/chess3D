import type * as THREE from 'three';

import type { Config } from '@lichess-org/chessground/config';

import { updateCheckHighlight } from './logic/checkHighlight.js';
import { fenToScene } from './logic/fen.js';
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

const SCENE_ASSET_URL = 'http://localhost:9663/assets/scene.glb';
const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

type ChessColor = 'white' | 'black';
type ChessKey = string;

export type ChessSceneConfig = Config;

export interface ChessScene {
  set(config: Partial<ChessSceneConfig>): void;
  move(from: ChessKey, to: ChessKey): void;
  destroy(): void;
}

export function createChessScene(sceneRoot: HTMLElement, config: ChessSceneConfig): ChessScene {
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

  let materials = new Map<string, THREE.Material>();
  let pieces = new Map<string, THREE.Mesh>();
  let isDestroyed = false;
  let currentOrientation: ChessColor | undefined;
  let currentTurnColor: ChessColor | undefined = config.turnColor;
  let currentCheck: ChessColor | boolean | undefined = config.check;
  let currentFen: string | undefined = config.fen;
  let currentLastMove: readonly ChessKey[] | undefined = config.lastMove;
  let highlightCheck = config.highlight?.check ?? true;
  let highlightLastMove = config.highlight?.lastMove ?? true;
  let isViewOnly = !!config.viewOnly;

  const whiteAzimuthAngle = getWhiteAzimuthAngle(controls);
  function setOrientation(orientation: ChessColor | undefined) {
    if (!orientation || orientation === currentOrientation) {
      return;
    }
    setControlsOrientation(camera, controls, orientation, whiteAzimuthAngle);

    currentOrientation = orientation;
  }

  setOrientation(config.orientation);

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

  let allowedMoveDests = config.movable?.dests;
  let showDests = config.movable?.showDests ?? true;
  type MoveEventCallback = NonNullable<NonNullable<Config['events']>['move']>;
  type MoveAfterCallback = NonNullable<NonNullable<NonNullable<Config['movable']>['events']>['after']>;
  let currentMoveHandler: MoveEventCallback | undefined = config.events?.move;
  let currentAfterMoveHandler: MoveAfterCallback | undefined = config.movable?.events?.after;

  function notifyMove(from: string, to: string) {
    currentMoveHandler?.(from as any, to as any);
    currentAfterMoveHandler?.(from as any, to as any, { premove: false });
  }

  interactionController.setAllowedMoveDests(allowedMoveDests, showDests);
  currentMoveHandler = config.events?.move;
  currentAfterMoveHandler = config.movable?.events?.after;
  setupMoveAttemptAdapter(interactionController, () => allowedMoveDests, notifyMove);

  function setAllowInteractionForColors(config: Partial<ChessSceneConfig>) {
    applyInteractionPolicy(interactionController, {
      isViewOnly,
      turnColor: config.turnColor,
      movableColor: config.movable?.color,
    });
  }

  setAllowInteractionForColors(config);

  // Load the scene and pieces
  void createPieceTemplates(scene, SCENE_ASSET_URL).then(
    ({ pieces: loadedPieces, materials: loadedMaterials }) => {
      pieces = loadedPieces;
      materials = loadedMaterials;

      fenToScene(currentFen || DEFAULT_FEN, scene, pieces, materials);
      interactionController.setLastMoveSquares(highlightLastMove ? currentLastMove : undefined);
      updateCheckHighlight(scene, checkHighlight, highlightCheck ? currentCheck : false, currentTurnColor);

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
    set(config) {
      if ('lastMove' in config) {
        currentLastMove = config.lastMove;
        interactionController.setLastMoveSquares(highlightLastMove ? config.lastMove : undefined);
      }

      if (config.fen) {
        currentFen = config.fen;
        fenToScene(currentFen, scene, pieces, materials);
        updateCheckHighlight(scene, checkHighlight, highlightCheck ? currentCheck : false, currentTurnColor);
      }

      if ('highlight' in config) {
        highlightLastMove = config.highlight?.lastMove ?? true;
        highlightCheck = config.highlight?.check ?? true;
        updateCheckHighlight(scene, checkHighlight, highlightCheck ? currentCheck : false, currentTurnColor);
      }

      if ('turnColor' in config) {
        currentTurnColor = config.turnColor;
        updateCheckHighlight(scene, checkHighlight, highlightCheck ? currentCheck : false, currentTurnColor);
      }

      if ('check' in config) {
        currentCheck = config.check;
        updateCheckHighlight(scene, checkHighlight, highlightCheck ? currentCheck : false, currentTurnColor);
      }

      if ('movable' in config) {
        allowedMoveDests = config.movable?.dests;
        showDests = config.movable?.showDests ?? true;
        currentAfterMoveHandler = config.movable?.events?.after;
        interactionController.setAllowedMoveDests(allowedMoveDests, showDests);
      }

      if ('events' in config) {
        currentMoveHandler = config.events?.move;
      }

      if ('viewOnly' in config) {
        isViewOnly = !!config.viewOnly;
      }

      if ('orientation' in config && config.orientation && config.orientation !== currentOrientation) {
        setOrientation(config.orientation);
      }

      setAllowInteractionForColors(config);
    },

    move(from, to) {
      interactionController.moveProgrammaticallyBySquare(from, to);
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
