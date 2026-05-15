import * as THREE from 'three';

import { updateCheckHighlight } from './logic/checkHighlight.js';
import { fenToScene } from './logic/fen.js';
import { createPieceHoverController } from './logic/hover.js';
import { setupPieceInteraction } from './logic/interaction.js';
import { createA1Marker, createCheckHighlightMarker, createH8Marker } from './objects/createMarkers.js';
import { createPieceTemplates } from './objects/createPieceTemplates.js';
import { createCamera } from './scene/createCamera.js';
import { createLights } from './scene/createLights.js';
import { createRenderer } from './scene/createRenderer.js';
import { createScene } from './scene/createScene.js';
import { createControls } from './systems/controls.js';
import { registerSceneRenderStep } from './systems/renderScheduler.js';
import { handleResize } from './systems/resize.js';

const SCENE_ASSET_URL = new URL('./public/scene.glb', import.meta.url).href;

type ChessColor = 'white' | 'black';
type ChessKey = string;

export interface ChessSceneConfig {
  viewOnly?: boolean;
  orientation?: ChessColor;
  fen?: string;
  lastMove?: readonly ChessKey[];
  turnColor?: ChessColor;
  check?: ChessColor | boolean;
  highlight?: {
    lastMove?: boolean;
    check?: boolean;
  };
  movable?: {
    color?: ChessColor | 'both';
    dests?: Map<ChessKey, readonly ChessKey[]>;
    showDests?: boolean;
  };
  events?: {
    move?: (...args: any[]) => void;
  };
}

export interface ChessScene {
  set(config: Partial<ChessSceneConfig>): void;
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

  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  let currentOrientation: ChessColor | undefined;
  let currentTurnColor: ChessColor | undefined = config.turnColor;
  let currentCheck: ChessColor | boolean | undefined = config.check;
  let highlightCheck = config.highlight?.check ?? true;
  let highlightLastMove = config.highlight?.lastMove ?? true;
  let isViewOnly = !!config.viewOnly;

  const whiteAzimuthAngle = controls.getAzimuthalAngle();
  const setLockedAzimuth = (azimuth: number) => {
    controls.minAzimuthAngle = azimuth;
    controls.maxAzimuthAngle = azimuth;
  };
  function setOrientation(orientation: ChessColor | undefined) {
    if (!orientation || orientation === currentOrientation) {
      return;
    }
    const azimuth = orientation === 'white' ? whiteAzimuthAngle : whiteAzimuthAngle + Math.PI;
    const normalizedAzimuth = THREE.MathUtils.euclideanModulo(azimuth + Math.PI, Math.PI * 2) - Math.PI;

    setLockedAzimuth(normalizedAzimuth);

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = normalizedAzimuth;
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);

    currentOrientation = orientation;
    camera.updateProjectionMatrix();
    controls.update();
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
  interactionController.setAllowedMoveDests(allowedMoveDests, showDests);

  if (config?.events?.move) {
    interactionController.setMoveAttemptCallback(uci => {
      const from = uci.slice(0, 2) as ChessKey;
      const to = uci.slice(2, 4) as ChessKey;
      if (allowedMoveDests && !allowedMoveDests.get(from)?.includes(to)) {
        return false;
      }
      config.events?.move?.(from, to);
      return true;
    });
  }

  function setAllowInteractionForColors(config: Partial<ChessSceneConfig>) {
    interactionController.setInteractionEnabled(!isViewOnly);
    if (isViewOnly) {
      interactionController.setAllowWhiteInteraction(false);
      interactionController.setAllowBlackInteraction(false);
      return;
    }

    if (config?.turnColor) {
      const isWhiteTurn = config.turnColor === 'white';
      const isMyTurn =
        (isWhiteTurn && config.movable?.color === 'white') ||
        (!isWhiteTurn && config.movable?.color === 'black') ||
        config.movable?.color === 'both';
      interactionController.setAllowWhiteInteraction(isWhiteTurn && isMyTurn);
      interactionController.setAllowBlackInteraction(!isWhiteTurn && isMyTurn);
    }
  }

  setAllowInteractionForColors(config);

  // Load the scene and pieces
  void createPieceTemplates(scene, SCENE_ASSET_URL).then(
    ({ pieces: loadedPieces, materials: loadedMaterials }) => {
      pieces = loadedPieces;
      materials = loadedMaterials;

      fenToScene(config?.fen || defaultFen, scene, pieces, materials);
      interactionController.setLastMoveSquares(highlightLastMove ? config?.lastMove : undefined);
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
        interactionController.setLastMoveSquares(highlightLastMove ? config.lastMove : undefined);
      }

      if (config.fen) {
        fenToScene(config.fen, scene, pieces, materials);
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
        interactionController.setAllowedMoveDests(allowedMoveDests, showDests);
      }

      if ('viewOnly' in config) {
        isViewOnly = !!config.viewOnly;
      }

      if ('orientation' in config && config.orientation && config.orientation !== currentOrientation) {
        setOrientation(config.orientation);
      }

      setAllowInteractionForColors(config);
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
