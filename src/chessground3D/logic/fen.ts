import * as THREE from 'three';

const pieceMap: Record<string, string> = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King',
};

const pieceCodes = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);

export function sceneToFen(scene: THREE.Scene): string {
  const board: (string | undefined)[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }));

  scene.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || !pieceCodes.has(obj.name) || !obj.userData?.isFenClone) {
      return;
    }

    const c = Math.round(obj.position.x + 3.5);
    const r = Math.round(obj.position.z + 3.5);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      board[r][c] = obj.name;
    }
  });

  return board
    .map(row => {
      let fenRow = '';
      let emptyCount = 0;
      for (const piece of row) {
        if (piece) {
          if (emptyCount > 0) {
            fenRow += emptyCount;
            emptyCount = 0;
          }
          fenRow += piece;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) {
        fenRow += emptyCount;
      }
      return fenRow;
    })
    .join('/');
}

// TODO: Use pieces from state
export function fenToScene(
  fen: string,
  scene: THREE.Scene,
  pieces: Map<string, THREE.Mesh>,
  materials: Map<string, THREE.Material>,
) {
  // Remove clones previously created.
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i];
    if (child.userData?.isFenClone) {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
      scene.remove(child);
    }
  }

  // Parse FEN and add pieces to the scene (creating clones of the original meshes)
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const char of rows[r]) {
      if (char >= '1' && char <= '8') {
        c += Number.parseInt(char, 10);
      } else {
        const pieceMesh = pieces.get(pieceMap[char.toUpperCase()]);

        if (pieceMesh) {
          const clone = pieceMesh.clone();
          clone.userData.isFenClone = true;
          clone.position.set(c - 3.5, 0, r - 3.5);
          clone.name = `${char}`; // Name the piece for later reference (e.g., "P" for white pawn, "p" for black pawn)
          // Reminder: X: horizontal positive to the right, Y: vertical positive up, Z: horizontal positive towards the camera
          const materialName = char === char.toUpperCase() ? 'white piece' : 'black piece';
          const material = materials.get(materialName);
          if (material) {
            clone.material = material.clone();
          } else if (Array.isArray(clone.material)) {
            clone.material = clone.material.map(m => m.clone());
          } else {
            clone.material = clone.material.clone();
          }
          clone.visible = true;
          scene.add(clone);
        }
        c++;
      }
    }
  }
}
