import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fenToScene } from './fen';
import { createPieceHoverController } from './hover';

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

const hoverController = createPieceHoverController(scene, camera, renderer.domElement);
window.addEventListener('pointermove', hoverController.updateFromPointerEvent);



// Main loop
function animate() {
  hoverController.update();

  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


