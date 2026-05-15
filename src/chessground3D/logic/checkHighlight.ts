import * as THREE from 'three';

type ChessColor = 'white' | 'black';

function getCheckedColor(check: ChessColor | boolean | undefined, turnColor: ChessColor | undefined) {
  if (!check) {
    return undefined;
  }
  if (check === true) {
    return turnColor;
  }
  return check;
}

export function updateCheckHighlight(
  scene: THREE.Scene,
  marker: THREE.Mesh,
  check: ChessColor | boolean | undefined,
  turnColor: ChessColor | undefined,
) {
  const checkedColor = getCheckedColor(check, turnColor);
  if (!checkedColor) {
    marker.visible = false;
    return;
  }

  const kingName = checkedColor === 'white' ? 'K' : 'k';
  let checkedKing: THREE.Mesh | undefined;
  scene.traverse(obj => {
    if (checkedKing || !(obj instanceof THREE.Mesh) || obj.name !== kingName) {
      return;
    }
    checkedKing = obj;
  });

  if (!checkedKing) {
    marker.visible = false;
    return;
  }

  marker.position.x = checkedKing.position.x;
  marker.position.z = checkedKing.position.z;
  marker.visible = true;
}
