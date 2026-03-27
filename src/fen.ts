import * as THREE from 'three';

const pieceMap: { [key: string]: string } = {
    'P': 'Pawn',
    'N': 'Knight',
    'B': 'Bishop',
    'R': 'Rook',
    'Q': 'Queen',
    'K': 'King'};
    
export function fenToScene(fen: string, scene: THREE.Scene, pieces: Map<string, THREE.Mesh>, materials: Map<string, THREE.Material>) {
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
                    clone.position.set(c - 3.5, 0, r - 3.5);
                    // Reminder: X: horizontal positive to the right, Y: vertical positive up, Z: horizontal positive towards the camera    
                    const materialName = char === char.toUpperCase() ? 'white piece' : 'black piece';
                    const material = materials.get(materialName);
                    clone.material = material || clone.material;
                    clone.visible = true;
                    scene.add(clone);
                }
                c++;
            }
        }
    }
}
