import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type ChessColor = 'white' | 'black';

function setLockedAzimuth(controls: OrbitControls, azimuth: number) {
  controls.minAzimuthAngle = azimuth;
  controls.maxAzimuthAngle = azimuth;
}

export function createControls(camera: THREE.Camera, domElement: HTMLElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  setLockedAzimuth(controls, controls.getAzimuthalAngle());
  return controls;
}

export function getWhiteAzimuthAngle(controls: OrbitControls): number {
  return controls.getAzimuthalAngle();
}

export function setControlsOrientation(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: OrbitControls,
  orientation: ChessColor,
  whiteAzimuthAngle: number,
) {
  const azimuth = orientation === 'white' ? whiteAzimuthAngle : whiteAzimuthAngle + Math.PI;
  const normalizedAzimuth = THREE.MathUtils.euclideanModulo(azimuth + Math.PI, Math.PI * 2) - Math.PI;

  setLockedAzimuth(controls, normalizedAzimuth);

  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta = normalizedAzimuth;
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);

  camera.updateProjectionMatrix();
  controls.update();
}
