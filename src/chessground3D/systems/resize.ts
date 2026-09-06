import type * as THREE from 'three';

export function handleResize(
  sceneElement: HTMLElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  const resize = () => {
    const { width, height } = sceneElement.getBoundingClientRect();
    if (width === 0 || height === 0) {
      return;
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  resize();
  window.addEventListener('resize', resize);

  const observer = new ResizeObserver(resize);
  observer.observe(sceneElement);

  return () => {
    window.removeEventListener('resize', resize);
    observer.disconnect();
  };
}
