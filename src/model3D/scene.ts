import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type { Key } from '@lichess-org/chessground/types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { fenToScene } from './fen.js';
import { createPieceHoverController } from './hover.js';
import { setupPieceInteraction } from './interaction.js';
import { createViewStatePersistence } from './viewState.js';

export function start3D(sceneRoot: HTMLElement, config: Config): Api {
  // Scene setup
  const scene = new THREE.Scene();
  scene.visible = false;
  scene.background = new THREE.Color(0x40_40_40);

  const loader = new GLTFLoader();
  const materials = new Map();
  const pieces = new Map();

  const sceneAssetUrl = (config as Config & { model3D: { sceneAssetUrl: string } }).model3D.sceneAssetUrl;
  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  let currentOrientation: 'white' | 'black' | undefined;
  let isViewOnly = !!config.viewOnly;

  // Camera
  const { width: initialWidth, height: initialHeight } = getSceneRootSize();
  const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 100);
  camera.position.set(0, 15, 8);
  camera.zoom = 1.5;
  camera.updateProjectionMatrix();

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(initialWidth, initialHeight);
  sceneRoot.appendChild(renderer.domElement);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  // Only allow horizontal/X-axis rotation.
  const whiteAzimuthAngle = controls.getAzimuthalAngle();
  const setLockedAzimuth = (azimuth: number) => {
    controls.minAzimuthAngle = azimuth;
    controls.maxAzimuthAngle = azimuth;
  };
  setLockedAzimuth(whiteAzimuthAngle);

  // Lighting
  const ambientLight = new THREE.HemisphereLight(0xff_ff_ff, 0x44_44_44, 2);
  scene.add(ambientLight);
  const light = new THREE.DirectionalLight(0xff_ff_ff, 0.5);
  light.position.set(0, 1, 1);
  light.target.position.set(0, 0, 0);
  scene.add(light);
  const light2 = new THREE.DirectionalLight(0xff_ff_ff, 0.5);
  light2.position.set(0, 1, -1);
  light2.target.position.set(0, 0, 0);
  scene.add(light2);

  const a1Marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 20),
    new THREE.MeshBasicMaterial({
      color: 0xf0_f0_f0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  a1Marker.rotation.x = -Math.PI / 2;
  a1Marker.position.set(-3.87, 0.02, 3.87);
  a1Marker.renderOrder = 7;
  scene.add(a1Marker);

  function setOrientation(orientation: 'white' | 'black' | undefined) {
    if (!orientation || orientation === currentOrientation) return;
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
    viewStatePersistence.schedulePersist();
  }

  const viewStatePersistence = createViewStatePersistence({
    sceneAssetUrl,
    camera,
    controls,
    getOrientation: () => currentOrientation,
    setOrientation,
  });

  if (!viewStatePersistence.restore()) {
    setOrientation(config.orientation);
  }

  controls.addEventListener('change', viewStatePersistence.schedulePersist);

  // Resize event
  window.addEventListener('resize', () => {
    const { width, height } = getSceneRootSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

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
      if (allowedMoveDests && !allowedMoveDests.get(from)?.includes(to)) return false;
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
  loader.load(sceneAssetUrl, (gltf: GLTF) => {
    scene.add(gltf.scene);
    gltf.scene.scale.set(1, 1, 1);
    scene.traverse(obj => {
      if (
        obj instanceof THREE.Mesh &&
        ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'].includes(obj.name)
      ) {
        obj.visible = false;
        pieces.set(obj.name, obj);
        if (
          obj.material &&
          !Array.isArray(obj.material) &&
          ['white piece', 'black piece'].includes(obj.material.name)
        ) {
          materials.set(obj.material.name, obj.material);
        }
      }
    });

    fenToScene(config?.fen || defaultFen, scene, pieces, materials);
    interactionController.setLastMoveSquares(config?.lastMove);

    scene.visible = true;
  });

  // Main loop
  function animate() {
    hoverController.update();
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Utils
  function getSceneRootSize() {
    return {
      width: sceneRoot.clientWidth || window.innerWidth,
      height: sceneRoot.clientHeight || window.innerHeight,
    };
  }

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
      controls.removeEventListener('change', viewStatePersistence.schedulePersist);
      viewStatePersistence.persist();

      console.warn(
        'Destroying the 3D scene is not fully implemented. You may want to remove the canvas from the DOM instead.',
      );
    },
    redrawAll() {
      // No internal state to redraw, but we can trigger a render if needed
    },
  };
}
