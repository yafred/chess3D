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
  return createCornerMarker('#d4d4d4', -3.87, 3.87);
}

export function createH8Marker() {
  return createCornerMarker('#525252', 3.87, -3.87);
}

export function createCheckHighlightMarker() {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({
      color: '#ff5c5c',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.012;
  marker.visible = false;
  marker.renderOrder = 11;
  return marker;
}

export function createMoveDestinationHighlightMarker(isOccupied: boolean) {
  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(isOccupied ? 0.5 : 0.2, 32),
    new THREE.MeshBasicMaterial({
      color: '#2f6fff',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.012;
  marker.visible = true;
  marker.renderOrder = 11;
  return marker;
}
