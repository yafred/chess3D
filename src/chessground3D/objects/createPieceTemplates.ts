import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const pieceNames = new Set(['King', 'Queen', 'Rook', 'Bishop', 'Knight', 'Pawn']);
const materialNames = new Set(['white piece', 'black piece']);

export type PieceTemplates = {
  pieceTemplates: Map<string, THREE.Mesh>;
  materialTemplates: Map<string, THREE.Material>;
};

export function createPieceTemplates(scene: THREE.Scene, sceneAssetUrl: string): Promise<PieceTemplates> {
  // Keep the loader here until we need it elsewhere.
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      sceneAssetUrl,
      gltf => {
        scene.add(gltf.scene);
        gltf.scene.scale.set(1, 1, 1);

        const pieceTemplates = new Map<string, THREE.Mesh>();
        const materialTemplates = new Map<string, THREE.Material>();

        gltf.scene.traverse(obj => {
          if (!(obj instanceof THREE.Mesh) || !pieceNames.has(obj.name)) {
            return;
          }

          obj.visible = false;
          pieceTemplates.set(obj.name, obj);

          if (obj.material && !Array.isArray(obj.material) && materialNames.has(obj.material.name)) {
            materialTemplates.set(obj.material.name, obj.material);
          }
        });

        resolve({ pieceTemplates, materialTemplates });
      },
      undefined,
      error => reject(error),
    );
  });
}
