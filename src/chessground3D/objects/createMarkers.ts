import * as THREE from 'three';

function createCornerMarker(color: string, x: number, z: number) {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 20),
    new THREE.MeshBasicMaterial({
      color,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(x, 0.02, z);
  marker.renderOrder = 7;
  return marker;
}

export function createA1Marker() {
  return createCornerMarker('#c5c5c5', -3.87, 3.87);
}

export function createH8Marker() {
  return createCornerMarker('#525252', 3.87, -3.87);
}

