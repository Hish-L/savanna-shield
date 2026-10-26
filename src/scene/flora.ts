import * as THREE from 'three';
import { FENCE_RADIUS, WATER_RADIUS, heightAt } from './terrain';
import { nav } from './nav';
import { seededRandom } from './util';

const bark = new THREE.MeshStandardMaterial({ color: '#5b4330', flatShading: true });
const leaves = new THREE.MeshStandardMaterial({ color: '#5f7a32', flatShading: true });
const baobabBark = new THREE.MeshStandardMaterial({ color: '#8d7a6a', flatShading: true });
const feverBark = new THREE.MeshStandardMaterial({ color: '#c9c25a', flatShading: true });
const feverLeaves = new THREE.MeshStandardMaterial({ color: '#7f9a3c', flatShading: true });
const sausageLeaves = new THREE.MeshStandardMaterial({ color: '#4c6b2c', flatShading: true });
const sausageFruit = new THREE.MeshStandardMaterial({ color: '#8a7a52', flatShading: true });

function acacia(random: () => number): THREE.Group {
  const tree = new THREE.Group();
  const height = 3.5 + random() * 2.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, height, 6), bark);
  trunk.position.y = height / 2;
  trunk.rotation.z = (random() - 0.5) * 0.25;
  tree.add(trunk);
  // The flat-topped umbrella canopy is what makes it read as "savanna" from far away.
  const layers = 2 + Math.floor(random() * 2);
  for (let i = 0; i < layers; i++) {
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leaves);
    const spread = 2.4 + random() * 1.6;
    canopy.scale.set(spread, 0.45, spread * (0.7 + random() * 0.3));
    canopy.position.set((random() - 0.5) * 1.6, height + i * 0.35, (random() - 0.5) * 1.6);
    canopy.castShadow = true;
    tree.add(canopy);
  }
  trunk.castShadow = true;
  return tree;
}

/** Baobab: a fat bottle-shaped trunk with short stubby branches and sparse leaf clumps. */
function baobab(random: () => number): THREE.Group {
  const tree = new THREE.Group();
  const height = 4 + random() * 1.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, height, 8), baobabBark);
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  tree.add(trunk);
  const branches = 5 + Math.floor(random() * 3);
  for (let i = 0; i < branches; i++) {
    const angle = (i / branches) * Math.PI * 2 + random() * 0.5;
    const length = 1.2 + random() * 0.8;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, length, 5), baobabBark);
    branch.position.set(Math.cos(angle) * 0.6, height + length * 0.35, Math.sin(angle) * 0.6);
    branch.rotation.set(Math.sin(angle) * 0.7, 0, -Math.cos(angle) * 0.7);
    branch.castShadow = true;
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + random() * 0.25, 0), leaves);
    clump.position.set(Math.cos(angle) * (0.6 + length * 0.65), height + length * 0.75, Math.sin(angle) * (0.6 + length * 0.65));
    clump.scale.y = 0.6;
    clump.castShadow = true;
    tree.add(branch, clump);
  }
  return tree;
}

/** Fever tree: a tall acacia with yellow-green bark and airy, layered canopies. */
function feverTree(random: () => number): THREE.Group {
  const tree = new THREE.Group();
  const height = 5.5 + random() * 2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, height, 6), feverBark);
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  tree.add(trunk);
  for (let i = 0; i < 3; i++) {
    const y = height * (0.6 + i * 0.2);
    const side = i % 2 ? 1 : -1;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.5, 4), feverBark);
    limb.position.set(side * 0.55, y - 0.35, 0);
    limb.rotation.z = -side * 0.9;
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), feverLeaves);
    canopy.scale.set(1.7 + random() * 0.6, 0.3, 1.4 + random() * 0.5);
    canopy.position.set(side * (1.1 + random() * 0.3), y, (random() - 0.5) * 0.6);
    limb.castShadow = canopy.castShadow = true;
    tree.add(limb, canopy);
  }
  return tree;
}

/** Sausage tree: a short trunk under a round, dense crown hung with long sausage-shaped fruit. */
function sausageTree(random: () => number): THREE.Group {
  const tree = new THREE.Group();
  const height = 3 + random() * 1;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, height, 6), bark);
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + random() * 0.6, 1), sausageLeaves);
  crown.scale.y = 0.7;
  crown.position.y = height + 1;
  crown.castShadow = true;
  tree.add(trunk, crown);
  for (let i = 0; i < 9; i++) {
    const angle = random() * Math.PI * 2;
    const r = 0.8 + random() * 1.1;
    const length = 0.5 + random() * 0.35;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3), bark);
    const fruit = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, length, 2, 6), sausageFruit);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    stalk.position.set(x, height - 0.1, z);
    fruit.position.set(x, height - 0.35 - length / 2, z);
    fruit.castShadow = true;
    tree.add(stalk, fruit);
  }
  return tree;
}

/** Mostly umbrella acacias, with baobabs, fever trees and sausage trees mixed in. */
const SPECIES = [
  { grow: acacia, weight: 0.55 },
  { grow: baobab, weight: 0.15 },
  { grow: feverTree, weight: 0.15 },
  { grow: sausageTree, weight: 0.15 },
];

function pickSpecies(roll: number): (random: () => number) => THREE.Group {
  for (const species of SPECIES) {
    if (roll < species.weight) return species.grow;
    roll -= species.weight;
  }
  return acacia;
}

const rockMaterial = new THREE.MeshStandardMaterial({ color: '#8f8578', flatShading: true });

/** Scatters `count` trees in a ring between `radius` and `radius + spread`. */
function plantTrees(flora: THREE.Group, random: () => number, count: number, radius: number, spread: number): void {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const r = radius + random() * spread;
    const tree = pickSpecies(random())(random);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    tree.position.set(x, heightAt(x, z) - 0.1, z);
    tree.rotation.y = random() * Math.PI * 2;
    tree.scale.setScalar(0.8 + random() * 0.5);
    flora.add(tree);
    // Animals walk round the trunk (the widest cylinder at its base); canopies are overhead.
    let trunk = 0;
    tree.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry) trunk = Math.max(trunk, o.geometry.parameters.radiusBottom);
    });
    nav.addObstacle(tree.position, trunk * tree.scale.x + 0.1);
  }
}

/** Scatters `count` boulders in a ring between `radius` and `radius + spread`. */
function placeRocks(flora: THREE.Group, random: () => number, count: number, radius: number, spread: number, size: number): void {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const r = radius + random() * spread;
    const extent = 0.6 + random() * size;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(extent, 0), rockMaterial);
    rock.position.copy(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
    rock.position.y = heightAt(rock.position.x, rock.position.z);
    rock.scale.y = 0.6;
    rock.castShadow = rock.receiveShadow = true;
    flora.add(rock);
    nav.addObstacle(rock.position, extent * 0.9);
  }
}

export function createFlora(): THREE.Group {
  const random = seededRandom(7);
  const flora = new THREE.Group();

  plantTrees(flora, random, 70, 25, 100);
  placeRocks(flora, random, 14, 21, 60, 1.4);

  // Extra background scenery on its own seed so the layout above stays put. Trees start beyond
  // the camera's orbit (38-46) so they fill the far side without blocking the view of the reserve.
  const background = seededRandom(19);
  plantTrees(flora, background, 70, 52, 98);
  placeRocks(flora, background, 30, 25, 95, 2);

  const tufts = 1820;
  const grass = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.14, 0.9, 3).translate(0, 0.4, 0),
    new THREE.MeshStandardMaterial({ flatShading: true }),
    tufts,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  for (let i = 0; i < tufts; i++) {
    const angle = random() * Math.PI * 2;
    // Re-roll tufts that would poke through the fence. Skipping them instead would leave their
    // instance matrix at the default origin, i.e. a spike in the middle of the pond.
    let radius: number;
    do radius = WATER_RADIUS + 1.5 + Math.pow(random(), 0.7) * 110;
    while (Math.abs(radius - FENCE_RADIUS) < 0.6);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.6 + random() * 0.9;
    q.setFromEuler(new THREE.Euler((random() - 0.5) * 0.4, random() * 3, (random() - 0.5) * 0.4));
    m.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(s, s * (0.8 + random()), s));
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, color.setHSL(0.11 + random() * 0.05, 0.5, 0.45 + random() * 0.2));
  }
  flora.add(grass);

  // Kilimanjaro on the horizon.
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(70, 42, 9),
    new THREE.MeshStandardMaterial({ color: '#7b6f8c', flatShading: true }),
  );
  mountain.position.set(60, 18, -190);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(19, 11.5, 9), new THREE.MeshStandardMaterial({ color: '#f2efe9', flatShading: true }));
  cap.position.y = 15.5;
  mountain.add(cap);
  flora.add(mountain);

  return flora;
}
