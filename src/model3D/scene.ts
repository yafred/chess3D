import { type Api } from '@lichess-org/chessground/api';
import { type Config } from '@lichess-org/chessground/config';
import { type Key } from '@lichess-org/chessground/types';
import * as THREE from 'three';

import { createPieceHoverController } from './hover.js';
import { setupPieceInteraction } from './interaction.js';
import { fenToScene } from './logic/fen.js';
import { createA1Marker } from './objects/createA1Marker.js';
import { createPieceTemplates } from './objects/createPieceTemplates.js';
import { createCamera } from './scene/createCamera.js';
import { createLights } from './scene/createLights.js';
import { createRenderer } from './scene/createRenderer.js';
import { createScene } from './scene/createScene.js';
import { createControls } from './systems/controls.js';
import { handleResize } from './systems/resize.js';

const SCENE_ASSET_URL = new URL('./public/scene.glb', import.meta.url).href;

export function start3D(sceneRoot: HTMLElement, config: Config): Api {
  const scene = createScene();
  const camera = createCamera(sceneRoot);
  const renderer = createRenderer(sceneRoot);
  const controls = createControls(camera, renderer.domElement);
  const lights = createLights();
  scene.add(lights);
  const a1Marker = createA1Marker();
  scene.add(a1Marker);
  handleResize(sceneRoot, camera, renderer);

  let materials = new Map<string, THREE.Material>();
  let pieces = new Map<string, THREE.Mesh>();

  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  let currentOrientation: 'white' | 'black' | undefined;
  let isViewOnly = !!config.viewOnly;

  const whiteAzimuthAngle = controls.getAzimuthalAngle();
  const setLockedAzimuth = (azimuth: number) => {
    controls.minAzimuthAngle = azimuth;
    controls.maxAzimuthAngle = azimuth;
  };
  function setOrientation(orientation: 'white' | 'black' | undefined) {
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

  if (config?.events?.move) {
    interactionController.setMoveAttemptCallback(uci => {
      const from = uci.slice(0, 2) as Key;
      const to = uci.slice(2, 4) as Key;
      if (allowedMoveDests && !allowedMoveDests.get(from)?.includes(to)) {
        return false;
      }
      config.events?.move?.(from, to);
      return true;
    });
  }

  function setAllowInteractionForColors(config: Config) {
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
      interactionController.setLastMoveSquares(config?.lastMove);

      scene.visible = true;
    },
  );

  // Main loop
  function animate() {
    hoverController.update();
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // API implementation
  return {
    state: {} as any, // No internal state needed for now

    set(config) {
      if ('lastMove' in config) {
        interactionController.setLastMoveSquares(config.lastMove);
      }

      if (config.fen) {
        fenToScene(config.fen, scene, pieces, materials);
      }

      if ('movable' in config) {
        allowedMoveDests = config.movable?.dests;
      }

      if ('viewOnly' in config) {
        isViewOnly = !!config.viewOnly;
      }

      if ('orientation' in config && config.orientation && config.orientation !== currentOrientation) {
        setOrientation(config.orientation);
      }

      setAllowInteractionForColors(config);
    },

    getFen() {
      console.warn('Getting FEN from the 3D scene is not implemented.');
      return '';
    },

    toggleOrientation() {
      console.warn('Toggling orientation is not implemented in this 3D scene.');
    },

    move(_orig, _dest) {
      console.warn(
        'Moving pieces programmatically is not implemented in this 3D scene. Please update the FEN instead.',
      );
    },

    setPieces(_piecesDiff) {
      console.warn(
        'Setting pieces programmatically is not implemented in this 3D scene. Please update the FEN instead.',
      );
    },

    selectSquare(_key, _force) {
      console.warn('Selecting squares programmatically is not implemented in this 3D scene.');
    },

    newPiece(_piece, _key) {
      console.warn(
        'Adding new pieces programmatically is not implemented in this 3D scene. Please update the FEN instead.',
      );
    },

    playPremove() {
      console.warn('Premoves are not supported in this 3D scene implementation.');
      return false;
    },

    cancelPremove() {
      console.warn('Premoves are not supported in this 3D scene implementation.');
    },

    playPredrop(_validate) {
      console.warn('Predrops are not supported in this 3D scene implementation.');
      return false;
    },

    cancelPredrop() {
      console.warn('Predrops are not supported in this 3D scene implementation.');
    },

    cancelMove() {
      console.warn('Cancelling moves is not supported in this 3D scene implementation.');
    },

    stop() {
      console.warn(
        'Stopping the 3D scene is not implemented. You may want to remove the canvas from the DOM instead.',
      );
    },

    explode(_keys) {
      console.warn('Exploding squares is not implemented in this 3D scene.');
    },

    setShapes(_shapes) {
      console.warn('Drawing shapes is not implemented in this 3D scene.');
    },

    setAutoShapes(_shapes) {
      console.warn('Auto-shapes are not implemented in this 3D scene.');
    },

    getKeyAtDomPos(_pos) {
      console.warn('Getting key at DOM position is not implemented in this 3D scene.');
      return undefined;
    },

    dragNewPiece(_piece, _event, _force) {
      console.warn('Dragging new pieces is not implemented in this 3D scene.');
    },

    destroy() {
      console.warn(
        'Destroying the 3D scene is not fully implemented. You may want to remove the canvas from the DOM instead.',
      );
    },
    redrawAll() {
      // No internal state to redraw, but we can trigger a render if needed
    },
  };
}
