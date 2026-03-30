import * as THREE from 'three';

const pieceMap: { [key: string]: string } = {
    'P': 'Pawn',
    'N': 'Knight',
    'B': 'Bishop',
    'R': 'Rook',
    'Q': 'Queen',
    'K': 'King'};
    
export function fenToScene(fen: string, scene: THREE.Scene, pieces: Map<string, THREE.Mesh>, materials: Map<string, THREE.Material>) {
    // Remove clones previously created.
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child.userData?.isFenClone) {
            scene.remove(child);
        }
    }

    // Parse FEN and add pieces to the scene (creating clones of the original meshes)
    const rows = fen.split(' ')[0].split('/');
    for (let r = 0; r < 8; r++) {
        let c = 0;
        for (const char of rows[r]) {
            if (char >= '1' && char <= '8') {
                c += parseInt(char);
            } else {
                const pieceMesh = pieces.get(pieceMap[char.toUpperCase()]);
    
                if (pieceMesh) {
                    const clone = pieceMesh.clone();
                    clone.userData.isFenClone = true;
                    clone.position.set(c - 3.5, 0, r - 3.5);
                    clone.name = `${char}`;  // Name the piece for later reference (e.g., "P" for white pawn, "p" for black pawn)
                    // Reminder: X: horizontal positive to the right, Y: vertical positive up, Z: horizontal positive towards the camera    
                    const materialName = char === char.toUpperCase() ? 'white piece' : 'black piece';
                    const material = materials.get(materialName);
                    if (material) {
                        clone.material = material.clone();
                    } else if (Array.isArray(clone.material)) {
                        clone.material = clone.material.map((m) => m.clone());
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
