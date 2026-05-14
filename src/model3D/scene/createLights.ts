import { dir } from 'console';
import * as THREE from 'three';

export function createLights() {
  const group = new THREE.Group();

  const ambient = new THREE.HemisphereLight('#ffffff', '#444444', 2);
  const directional1 = new THREE.DirectionalLight('#ffffff', 0.5);
  directional1.position.set(0, 1, 1);
  directional1.target.position.set(0, 0, 0);

  const directional2 = new THREE.DirectionalLight('#ffffff', 0.5);
  directional2.position.set(0, 1, -1);
  directional2.target.position.set(0, 0, 0);

  group.add(ambient, directional1, directional2);
  return group;
}
