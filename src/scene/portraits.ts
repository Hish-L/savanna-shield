import * as THREE from 'three';
import type { Animal } from '../game/types';
import { crocodile, hyena, poacher, ranger, type Model } from './actors/models';

export type Portrait = Animal | 'ranger';

const SIZE = 256;

const FRONT_THREE_QUARTER = new THREE.Vector3(0.6, 0.25, 1).normalize();

/**
 * Per character: the direction the camera looks from (every model faces +z), how far away it sits
 * in head-sizes, and how far below the head's centre it aims, also in head-sizes.
 */
const SHOTS: Record<Portrait, { build: () => Model; view: THREE.Vector3; distance: number; drop: number }> = {
  ranger: { build: ranger, view: FRONT_THREE_QUARTER, distance: 2.0, drop: 0.2 },
  hyena: { build: hyena, view: new THREE.Vector3(0.35, 0.2, 1).normalize(), distance: 1.8, drop: 0.1 },
  crocodile: { build: crocodile, view: new THREE.Vector3(1, 0.3, 0.85).normalize(), distance: 2.2, drop: 0 },
  poacher: { build: poacher, view: FRONT_THREE_QUARTER, distance: 2.5, drop: 0.25 },
};

/**
 * Renders a headshot of each character from its in-game model, once at startup, as PNG data URLs.
 * Uses its own small renderer with the reserve's afternoon light, then releases it.
 */
export function renderPortraits(): Record<Portrait, string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight('#fff1d6', 2.6);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6);
  rim.position.set(-4, 3, -4);
  scene.add(key, rim, new THREE.HemisphereLight('#cfe6ff', '#8a6b3c', 1.1));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);

  const urls = {} as Record<Portrait, string>;
  for (const [name, shot] of Object.entries(SHOTS) as [Portrait, (typeof SHOTS)[Portrait]][]) {
    const model = shot.build();
    scene.add(model.root);
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.head!);
    const size = bounds.getSize(new THREE.Vector3()).length();
    const target = bounds.getCenter(new THREE.Vector3()).addScaledVector(THREE.Object3D.DEFAULT_UP, -size * shot.drop);
    camera.position.copy(target).addScaledVector(shot.view, size * shot.distance);
    camera.lookAt(target);
    renderer.render(scene, camera);
    urls[name] = renderer.domElement.toDataURL('image/png');
    scene.remove(model.root);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
