import * as THREE from 'three';

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

export type PieceHoverController = {
  updateFromPointerEvent: (event: PointerEvent) => void;
  update: () => void;
};

function getColorMaterial(mesh: THREE.Mesh): (THREE.Material & { color: THREE.Color }) | null {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return null;
  }

  const candidate = material as THREE.Material & { color?: unknown };
  return candidate.color instanceof THREE.Color
    ? (material as THREE.Material & { color: THREE.Color })
    : null;
}

function getPieceMeshFromObject(object: THREE.Object3D | null): THREE.Mesh | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current instanceof THREE.Mesh && pieceCodes.has(current.name)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

export function createPieceHoverController(
  scene: THREE.Scene,
  camera: THREE.Camera,
  domElement: HTMLElement,
): PieceHoverController {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered: THREE.Mesh | null = null;
  const squareHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf7e27f,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  squareHighlight.rotation.x = -Math.PI / 2;
  squareHighlight.position.y = 0.01;
  squareHighlight.visible = false;
  squareHighlight.renderOrder = 10;
  scene.add(squareHighlight);

  return {
    updateFromPointerEvent(event: PointerEvent) {
      const rect = domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    update() {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      let hitPiece: THREE.Mesh | null = null;
      for (const intersection of hits) {
        const candidate = getPieceMeshFromObject(intersection.object);
        if (candidate) {
          hitPiece = candidate;
          break;
        }
      }

      if (hovered && hovered !== hitPiece) {
        const hoveredMaterial = getColorMaterial(hovered);
        if (hoveredMaterial && hovered.userData.originalColor instanceof THREE.Color) {
          hoveredMaterial.color.copy(hovered.userData.originalColor);
        }
        hovered = null;
      }

      if (!hitPiece || hovered === hitPiece) {
        if (!hitPiece) {
          squareHighlight.visible = false;
        }
        return;
      }

      const hitMaterial = getColorMaterial(hitPiece);
      if (!hitMaterial) {
        return;
      }

      hovered = hitPiece;
      hovered.userData.originalColor = hitMaterial.color.clone();
      hitMaterial.color.copy(hovered.userData.originalColor).multiplyScalar(0.5);

      squareHighlight.position.x = hovered.position.x;
      squareHighlight.position.z = hovered.position.z;
      squareHighlight.visible = true;
    },
  };
}