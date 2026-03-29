/// <reference types="vite/client" />

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fenToScene } from './fen';
import { createPieceHoverController } from './hover';

declare global {
  interface Window {
    displayFen: (fen: string) => void;
  }
}

const scene = new THREE.Scene();
scene.visible = false;
scene.background = new THREE.Color(0x404040);

const loader = new GLTFLoader();
const materials = new Map();
const pieces = new Map();
const sceneAssetUrl = `${import.meta.env.BASE_URL}scene.glb`;
const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
let pendingFen: string | null = null;

function displayFenInScene(fen: string) {
  if (pieces.size === 0) {
    pendingFen = fen;
    console.warn('Pieces are still loading. FEN queued and will be shown when ready.');
    return;
  }

  fenToScene(fen, scene, pieces, materials);
  scene.visible = true;
}

window.displayFen = displayFenInScene;

loader.load(sceneAssetUrl, (gltf) => {
  scene.add(gltf.scene);
  gltf.scene.scale.set(1, 1, 1);
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && ['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn'].includes(obj.name)) {
      obj.visible = false; 
      pieces.set(obj.name, obj);
      if (obj.material && !Array.isArray(obj.material) && ['white piece', 'black piece'].includes(obj.material.name)) {
        materials.set(obj.material.name, obj.material);
      }
    }
  });

  displayFenInScene(pendingFen ?? defaultFen);
  pendingFen = null;
});

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 8, 10);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2); 
scene.add( ambientLight );

const light = new THREE.DirectionalLight(0xffffff, .5);
light.position.set(0, 1, 1);
light.target.position.set(0, 0, 0);
scene.add(light);
const light2 = new THREE.DirectionalLight(0xffffff, .5);
light2.position.set(0, 1, -1);
light2.target.position.set(0, 0, 0);
scene.add(light2);

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hoverController = createPieceHoverController(scene, camera, renderer.domElement);
window.addEventListener('pointermove', hoverController.updateFromPointerEvent);

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);
const pointerRaycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const boardPoint = new THREE.Vector3();

type DragState = {
  piece: THREE.Mesh;
  pointerId: number;
  startPosition: THREE.Vector3;
};

let dragState: DragState | null = null;

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

function isPointerOverPiece(event: PointerEvent): boolean {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  pointerRaycaster.setFromCamera(pointerNdc, camera);
  const hits = pointerRaycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    if (getPieceMeshFromObject(hit.object)) {
      return true;
    }
  }

  return false;
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

let activeMouseButton: number | null = null;
let hoverDisabledForOrbit = false;

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



// Main loop
function animate() {
  hoverController.update();

  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


