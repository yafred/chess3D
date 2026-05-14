import * as THREE from 'three';

export function createRenderer(sceneElement: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(sceneElement.clientWidth, sceneElement.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  sceneElement.appendChild(renderer.domElement);
  return renderer;
}
