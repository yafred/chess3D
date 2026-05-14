import * as THREE from 'three';

export function createCamera(sceneElement: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(
    45,
    sceneElement.clientWidth / sceneElement.clientHeight,
    0.1,
    100,
  );
  camera.position.set(0, 15, 8);
  camera.zoom = 1.5;
  camera.updateProjectionMatrix();
  return camera;
}
