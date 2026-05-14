import * as THREE from 'three';

export function handleResize(
  sceneElement: HTMLElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  window.addEventListener('resize', () => {
    const { width, height } = sceneElement.getBoundingClientRect();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
}
