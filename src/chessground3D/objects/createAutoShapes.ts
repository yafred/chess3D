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

const CUSTOM_SVG_HEIGHT = 0.021;

export function createCustomSvgMesh(x: number, z: number, svgHtml: string, size = 2.0): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, CUSTOM_SVG_HEIGHT, z);
  mesh.renderOrder = 13;

  // Render a 200x200 viewBox centered on the square [0..100] (spanning [-50..150]),
  // mapped onto a 2.0x2.0 plane so badges and drop shadows can overlap adjacent squares without clipping.
  // Translating by (0, 84) shifts elements originally anchored near the top corner (~(91, 8))
  // down to the bottom corner (~(91, 92)).
  const fullSvg = svgHtml.trim().startsWith('<svg')
    ? svgHtml
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 200 200" width="512" height="512" style="overflow: visible"><g transform="translate(0, 84)">${svgHtml}</g></svg>`;

  const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
    }
    URL.revokeObjectURL(url);
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
  };

  img.src = url;

  return mesh;
}
