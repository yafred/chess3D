import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createControls(camera: THREE.Camera, domElement: HTMLElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  const whiteAzimuthAngle = controls.getAzimuthalAngle();
  const setLockedAzimuth = (azimuth: number) => {
    controls.minAzimuthAngle = azimuth;
    controls.maxAzimuthAngle = azimuth;
  };
  setLockedAzimuth(whiteAzimuthAngle);
  return controls;
}
