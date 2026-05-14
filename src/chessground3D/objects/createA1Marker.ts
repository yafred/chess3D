import * as THREE from 'three';

export function createA1Marker() {
  const a1Marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 20),
    new THREE.MeshBasicMaterial({
      color: '#f0f0f0',
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  a1Marker.rotation.x = -Math.PI / 2;
  a1Marker.position.set(-3.87, 0.02, 3.87);
  a1Marker.renderOrder = 7;
  return a1Marker;
}
