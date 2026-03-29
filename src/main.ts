import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fenToScene } from './fen';

const scene = new THREE.Scene();
scene.visible = false;
scene.background = new THREE.Color(0x404040);

const loader = new GLTFLoader();
const materials = new Map();
const pieces = new Map();
loader.load('/scene.glb', (gltf) => {
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

  fenToScene('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', scene, pieces, materials);
  scene.visible = true;
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

// Hover
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered: THREE.Mesh | null = null;
const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

function getColorMaterial(mesh: THREE.Mesh): (THREE.Material & { color: THREE.Color }) | null {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return null;
  }

  const candidate = material as THREE.Material & { color?: unknown };
  return candidate.color instanceof THREE.Color
    ? (material as THREE.Material & { color: THREE.Color })
    : null;
}

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

window.addEventListener('pointermove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});



// Main loop
function animate() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  const hitPiece = hits
    .map((intersection) => getPieceMeshFromObject(intersection.object))
    .find((mesh): mesh is THREE.Mesh => mesh !== null) ?? null;

  if (hovered && hovered !== hitPiece) {
    const hoveredMaterial = getColorMaterial(hovered);
    if (hoveredMaterial && hovered.userData.originalColor instanceof THREE.Color) {
      hoveredMaterial.color.copy(hovered.userData.originalColor);
    }
    hovered = null;
  }

  if (hitPiece) {
    const hitMaterial = getColorMaterial(hitPiece);
    if (!hitMaterial) {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      return;
    }

    if (hovered !== hitPiece) {
      hovered = hitPiece;
      hovered.userData.originalColor = hitMaterial.color.clone();
      hitMaterial.color.copy(hovered.userData.originalColor).multiplyScalar(0.5);
    }
  }

  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


