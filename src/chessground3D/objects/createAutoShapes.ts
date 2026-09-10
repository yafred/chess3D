import * as THREE from 'three';

const ARROW_HEIGHT = 0.02;
const SHAFT_WIDTH = 0.12;
const HEAD_WIDTH = 0.32;
const HEAD_LENGTH = 0.35;
const TIP_GAP = 0.35; // leave room near the destination square center

export function createArrowMesh(
  origX: number,
  origZ: number,
  destX: number,
  destZ: number,
  color: string,
  opacity: number,
): THREE.Mesh {
  const dx = destX - origX;
  const dz = destZ - origZ;
  const length = Math.hypot(dx, dz);
  const effectiveLength = Math.max(length - TIP_GAP, 0.01);
  const headLength = Math.min(HEAD_LENGTH, effectiveLength);
  const shaftEnd = effectiveLength - headLength;

  const ux = dx / length;
  const uz = dz / length;
  const px = -uz;
  const pz = ux;

  const point = (u: number, v: number) =>
    new THREE.Vector3(origX + ux * u + px * v, ARROW_HEIGHT, origZ + uz * u + pz * v);

  const shaftStartLeft = point(0, SHAFT_WIDTH / 2);
  const shaftStartRight = point(0, -SHAFT_WIDTH / 2);
  const shaftEndLeft = point(shaftEnd, SHAFT_WIDTH / 2);
  const shaftEndRight = point(shaftEnd, -SHAFT_WIDTH / 2);
  const headBaseLeft = point(shaftEnd, HEAD_WIDTH / 2);
  const headBaseRight = point(shaftEnd, -HEAD_WIDTH / 2);
  const tip = point(effectiveLength, 0);

  const vertices = [
    shaftStartLeft,
    shaftStartRight,
    shaftEndRight,
    shaftStartLeft,
    shaftEndRight,
    shaftEndLeft,
    headBaseLeft,
    headBaseRight,
    tip,
  ];

  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((v, i) => v.toArray(positions, i * 3));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 12;
  return mesh;
}
