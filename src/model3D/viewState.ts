import type * as THREE from 'three';
import { type OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface PersistedViewState {
  cameraPosition: [number, number, number];
  cameraZoom: number;
  controlsTarget: [number, number, number];
  orientation?: 'white' | 'black';
}

interface CreateViewStatePersistenceOpts {
  sceneAssetUrl: string;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  getOrientation?: () => 'white' | 'black' | undefined;
  setOrientation?: (orientation: 'white' | 'black' | undefined) => void;
}

function isFiniteTuple3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item))
  );
}

export function createViewStatePersistence({
  sceneAssetUrl,
  camera,
  controls,
  getOrientation,
  setOrientation,
}: CreateViewStatePersistenceOpts) {
  const storageKey = `chessground:real3d:view:${sceneAssetUrl}`;

  function getStoredViewState(): PersistedViewState | undefined {
    try {
      const rawState = window.localStorage.getItem(storageKey);
      if (!rawState) {
        return undefined;
      }
      const parsedState = JSON.parse(rawState) as Partial<PersistedViewState>;

      if (
        !isFiniteTuple3(parsedState.cameraPosition) ||
        !isFiniteTuple3(parsedState.controlsTarget) ||
        typeof parsedState.cameraZoom !== 'number' ||
        !Number.isFinite(parsedState.cameraZoom)
      ) {
        return undefined;
      }

      return {
        cameraPosition: parsedState.cameraPosition,
        cameraZoom: parsedState.cameraZoom,
        controlsTarget: parsedState.controlsTarget,
        orientation:
          parsedState.orientation === 'white' || parsedState.orientation === 'black'
            ? parsedState.orientation
            : undefined,
      };
    } catch {
      return undefined;
    }
  }

  function persist() {
    try {
      const state: PersistedViewState = {
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        cameraZoom: camera.zoom,
        controlsTarget: [controls.target.x, controls.target.y, controls.target.z],
        orientation: getOrientation?.(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore persistence errors (private mode, quota, or disabled storage).
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const schedulePersist = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(persist, 300);
  };

  function restore(): boolean {
    const storedState = getStoredViewState();
    if (!storedState) {
      return false;
    }

    camera.position.set(...storedState.cameraPosition);
    camera.zoom = storedState.cameraZoom;
    controls.target.set(...storedState.controlsTarget);
    camera.updateProjectionMatrix();
    controls.update();
    setOrientation?.(storedState.orientation);
    return true;
  }

  return {
    persist,
    schedulePersist,
    restore,
  };
}
