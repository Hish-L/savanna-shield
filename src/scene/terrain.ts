import * as THREE from 'three';

export const WATER_RADIUS = 9;
export const WATER_LEVEL = -0.25;
export const FENCE_RADIUS = 16.5;

const smooth = THREE.MathUtils.smoothstep;

/** Ground height: a flat plain around the waterhole, rolling hills further out. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.05) * 3 + Math.sin(x * 0.11 + z * 0.07) * 1.2 + Math.sin(z * 0.13 - x * 0.03) * 0.8;
  const bumps = Math.sin(x * 0.3) * Math.sin(z * 0.27) * 0.15;
  const bowl = -0.9 * (1 - smooth(r, WATER_RADIUS - 1, WATER_RADIUS + 1.5));
  return hills * smooth(r, 28, 70) + bumps * smooth(r, 9, 12) + bowl;
}

export function createTerrain(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(320, 320, 160, 160);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dry = new THREE.Color('#d2ae58');
  const pale = new THREE.Color('#e2c886');
  const olive = new THREE.Color('#9c9a48');
  const mud = new THREE.Color('#6e5533');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const patch = Math.sin(x * 0.08 + Math.cos(z * 0.06) * 2) * 0.5 + 0.5;
    c.copy(dry).lerp(pale, patch * 0.6).lerp(olive, Math.max(0, Math.sin(z * 0.05 - x * 0.04)) * 0.45);
    c.lerp(mud, 1 - smooth(Math.hypot(x, z), WATER_RADIUS, WATER_RADIUS + 2.5));
    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}
