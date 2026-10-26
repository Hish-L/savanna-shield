import * as THREE from 'three';
import { heightAt } from './terrain';
import { ranger } from './actors/models';
import { nav, type Body } from './nav';
import { box, canvasTexture, damp } from './util';

const wood = new THREE.MeshStandardMaterial({ color: '#7a5a3a', flatShading: true });
const poleWood = new THREE.MeshStandardMaterial({ color: '#6e5136', flatShading: true });
const lampMetal = new THREE.MeshStandardMaterial({ color: '#2b2b30', metalness: 0.5, roughness: 0.5, flatShading: true });

/** Woven reed screen with an ochre band of Ndebele-style triangles, repeated along each side of the lookout. */
const reedScreen = canvasTexture(
  512,
  (ctx) => {
    for (let x = 0; x < 512; x += 4) {
      ctx.fillStyle = ['#d9b56a', '#c9a35a', '#b8914c'][(x / 4) % 3];
      ctx.fillRect(x, 0, 4, 64);
    }
    ctx.fillStyle = '#a8432a';
    ctx.fillRect(0, 24, 512, 18);
    for (let x = 0; x < 512; x += 32) {
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x + 16, 24);
      ctx.lineTo(x + 32, 42);
      ctx.fill();
      ctx.fillStyle = '#f4f1ea';
      ctx.beginPath();
      ctx.moveTo(x + 10, 42);
      ctx.lineTo(x + 16, 35);
      ctx.lineTo(x + 22, 42);
      ctx.fill();
    }
  },
  64,
);

/** A rough round pole from `from` to `to`, tapering slightly toward `to`. */
function stick(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const dir = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, dir.length(), 6), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

/**
 * Watchtower = security monitoring: a bush lookout of lashed poles and an open, reed-screened
 * platform where the Chief Ranger keeps watch behind a post-mounted searchlight. He swings round
 * with the light, which sweeps faster and brighter on alert.
 */
export class Watchtower {
  readonly group = new THREE.Group();
  private readonly beamMaterial = new THREE.MeshBasicMaterial({
    color: '#fff3b8',
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly beam: THREE.Mesh;
  private readonly light = new THREE.SpotLight('#fff1c0', 0, 60, 0.32, 0.5, 1.2);
  /** The Chief Ranger and the searchlight, turning together on the platform. */
  private readonly lookout = new THREE.Group();
  private readonly lamp: THREE.Vector3;
  private angle = 0;
  private alertLevel = 0;
  private alertHold = 0;
  private focus: THREE.Vector3 | null = null;

  constructor(position: THREE.Vector3) {
    this.group.position.copy(position);
    nav.addObstacle(position, 2.1); // splayed legs and the ladder foot
    // Square to the waterhole, so the ladder side faces it.
    this.group.rotation.y = Math.atan2(-position.x, -position.z);
    const deckY = 6.3;
    // Four poles splay out toward the ground and carry the open platform.
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const at = (corner: number[], y: number, lean = 0) => {
      const spread = 1.15 - (0.4 * y) / deckY;
      return new THREE.Vector3(corner[0] * spread + lean, y, corner[1] * spread - lean);
    };
    corners.forEach((corner, i) => {
      const lean = (i % 2 ? 1 : -1) * 0.06; // not quite straight, like cut saplings
      this.group.add(stick(at(corner, 0), at(corner, deckY, lean), 0.16, poleWood));
      // Lashed X-bracing and a rail between this pole and the next.
      const next = corners[(i + 1) % 4];
      this.group.add(
        stick(at(corner, 0.7), at(next, 3.6), 0.06, poleWood),
        stick(at(next, 0.7), at(corner, 3.6), 0.06, poleWood),
        stick(at(corner, 3.6), at(next, 3.6), 0.07, poleWood),
      );
    });

    // Square plank deck with a reed screen on each side, capped by a pole rail and corner posts.
    const half = 1.45;
    // Dark planks so the khaki-and-red lookout stands out against them from the camera above.
    const deck = box(half * 2 + 0.2, 0.22, half * 2 + 0.2, new THREE.MeshStandardMaterial({ color: '#4a3420', flatShading: true }));
    deck.position.y = deckY;
    this.group.add(deck);
    const screenMap = reedScreen.clone();
    screenMap.wrapS = THREE.RepeatWrapping;
    screenMap.repeat.x = 6 / 16; // six whole triangles per side
    const screenMaterial = new THREE.MeshStandardMaterial({ map: screenMap, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const side = new THREE.Group();
      side.rotation.y = (i * Math.PI) / 2;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 0.85), screenMaterial);
      screen.position.set(0, deckY + 0.53, half);
      screen.castShadow = true;
      const rail = stick(new THREE.Vector3(-half, deckY + 0.95, half), new THREE.Vector3(half, deckY + 0.95, half), 0.07, poleWood);
      const post = stick(new THREE.Vector3(half, deckY, half), new THREE.Vector3(half, deckY + 1.05, half), 0.09, poleWood);
      side.add(screen, rail, post);
      this.group.add(side);
    }

    // The Chief Ranger stands at the back of the platform behind a searchlight on a short post.
    const chief = ranger(true).root;
    chief.scale.multiplyScalar(1.2); // a touch larger than life so he reads from across the reserve
    chief.position.set(0, deckY + 0.11, -0.35);
    const post = stick(new THREE.Vector3(0, deckY + 0.11, 0.55), new THREE.Vector3(0, deckY + 1.15, 0.55), 0.05, poleWood);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 10).rotateX(Math.PI / 2), lampMetal);
    housing.position.set(0, deckY + 1.3, 0.6);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), new THREE.MeshBasicMaterial({ color: '#fff6cf' }));
    glass.position.set(0, deckY + 1.3, 0.81);
    this.lookout.add(chief, post, housing, glass);
    this.group.add(this.lookout);
    this.lamp = new THREE.Vector3(0, deckY + 1.3, 0.85);

    // Pole ladder up to the platform, on the side facing the waterhole.
    const ladder = new THREE.Group();
    const foot = 2.4;
    const top = half + 0.15; // just outside the reed screen
    for (const x of [-0.28, 0.28]) ladder.add(stick(new THREE.Vector3(x, 0, foot), new THREE.Vector3(x, deckY + 0.4, top), 0.06, poleWood));
    for (let y = 0.5; y < deckY; y += 0.55) {
      const z = foot + ((top - foot) * y) / (deckY + 0.4);
      ladder.add(stick(new THREE.Vector3(-0.3, y, z), new THREE.Vector3(0.3, y, z), 0.035, poleWood));
    }
    this.group.add(ladder);

    const length = 16;
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, length, 20, 1, true).translate(0, -length / 2, 0).rotateX(-Math.PI / 2),
      this.beamMaterial,
    );
    this.group.add(this.beam, this.light, this.light.target);
  }

  /** Lock the searchlight onto the threat at full brightness for `seconds`, then fade back to sweeping. */
  alert(focus: THREE.Vector3 | null, seconds: number): void {
    this.alertLevel = 1;
    this.alertHold = seconds;
    this.focus = focus?.clone() ?? null;
  }

  update(dt: number): void {
    this.alertHold -= dt;
    if (this.alertHold <= 0) this.alertLevel = damp(this.alertLevel, 0, 0.8, dt);
    this.angle += dt * (0.35 + this.alertLevel * 1.4);
    const sweep = new THREE.Vector3(Math.cos(this.angle) * 11, 0, Math.sin(this.angle) * 11);
    const world = this.focus && this.alertLevel > 0.3 ? this.focus : sweep;
    const local = this.group.worldToLocal(world.clone());
    local.y = heightAt(world.x, world.z) - this.group.position.y;
    // Turn the lookout to face the target; the beam comes out of the lamp wherever that now is.
    this.lookout.rotation.y = Math.atan2(local.x, local.z);
    const lamp = this.lamp.clone().applyEuler(this.lookout.rotation);
    this.beam.position.copy(lamp);
    this.light.position.copy(lamp);
    this.light.target.position.copy(local);
    this.beam.lookAt(this.group.localToWorld(local.clone()));
    this.beam.scale.z = local.distanceTo(lamp) / 16;
    this.beamMaterial.opacity = 0.1 + this.alertLevel * 0.25;
    this.light.intensity = 120 + this.alertLevel * 380;
  }
}

/**
 * Ranger station = the bank's systems. Whitewashed walls under a Westpac-red roof so it stands out
 * from the tan savanna; the door faces the waterhole. Ransomware sets it alight.
 */
export function createStation(position: THREE.Vector3): THREE.Group {
  const hut = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 1.8, 10), new THREE.MeshStandardMaterial({ color: '#f4f1ea', flatShading: true }));
  walls.position.y = 0.9;
  walls.castShadow = walls.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#da1710', flatShading: true }));
  roof.position.y = 2.6;
  roof.castShadow = true;
  // Unlit so it reads as solid black; set out far enough that the flared wall's corner can't poke through.
  const door = box(0.6, 1.1, 0.12, new THREE.MeshBasicMaterial({ color: '#000' }));
  door.position.set(0, 0.55, 1.72);
  const antenna = box(0.08, 2, 0.08, wood);
  antenna.position.set(0.6, 3.6, 0);
  hut.add(walls, roof, door, antenna);
  const glass = new THREE.MeshStandardMaterial({ color: '#8fc6e8', emissive: '#8fc6e8', emissiveIntensity: 0.2, flatShading: true });
  for (const angle of [-1, 1]) {
    const pane = box(0.45, 0.4, 0.1, glass);
    pane.position.set(Math.sin(angle) * 1.62, 1.15, Math.cos(angle) * 1.62);
    pane.rotation.y = angle;
    hut.add(pane);
  }
  hut.position.copy(position);
  hut.rotation.y = Math.atan2(-position.x, -position.z);
  hut.scale.setScalar(1.35);
  nav.addObstacle(position, 1.7 * 1.35);
  return hut;
}

const POLICE_BLUE = '#0b2f8f';

function glowMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
}

function policeLivery(): THREE.CanvasTexture {
  // Side decal for a 3 x 1.5 panel: POLICE lettering over a two-row blue-and-white check band.
  // The square canvas is stretched 2:1 across the panel, so draw in a 512 x 256 space scaled up.
  return canvasTexture(512, (ctx) => {
    ctx.scale(1, 2);
    const cell = 34;
    for (let col = 0; col * cell < 512; col++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (col + row) % 2 ? '#ffffff' : POLICE_BLUE;
        ctx.fillRect(col * cell, 150 + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = POLICE_BLUE;
    ctx.fillRect(0, 144, 512, 6);
    ctx.fillRect(0, 218, 512, 6);
    ctx.font = '900 58px "Avenir Next", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 256, 128);
  });
}

/**
 * Police van = incident response. Drives out toward the threat and back, lights flashing, steering
 * round the pond and buildings; animals in its way are shoved aside.
 */
export class Jeep implements Body {
  readonly group = new THREE.Group();
  readonly radius = 1.9;
  readonly heavy = true;
  private readonly heading = new THREE.Vector3();
  private readonly home: THREE.Vector3;
  private target: THREE.Vector3 | null = null;
  private returning = false;
  private linger = 0;
  private readonly red = new THREE.MeshStandardMaterial({ color: '#d01818', emissive: '#ff1a1a', emissiveIntensity: 0.5 });
  private readonly blue = new THREE.MeshStandardMaterial({ color: '#1838d0', emissive: '#2a5bff', emissiveIntensity: 0.5 });
  private readonly redGlow = glowMaterial('#ff2a2a');
  private readonly blueGlow = glowMaterial('#3a6bff');
  private readonly siren = new THREE.PointLight('#ff2a2a', 0, 14, 1.5);
  private time = 0;

  constructor(home: THREE.Vector3) {
    this.home = home.clone();
    this.group.position.copy(home);
    nav.addMover(this);
    // Model faces +z: a high-roof white van with a short nose.
    const white = new THREE.MeshStandardMaterial({ color: '#f4f6f8', flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#222222', flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3a', metalness: 0.4, roughness: 0.15 });
    const headlight = new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#fff6d0', emissiveIntensity: 0.6 });

    const body = box(1.6, 1.5, 3.0, white);
    body.position.set(0, 1.15, -0.2);
    const nose = box(1.6, 0.7, 0.5, white);
    nose.position.set(0, 0.75, 1.55);
    const windscreen = box(1.4, 0.55, 0.05, glass);
    windscreen.position.set(0, 1.5, 1.31);
    const bullbar = box(1.7, 0.25, 0.15, dark);
    bullbar.position.set(0, 0.55, 1.85);
    const rearBumper = box(1.7, 0.2, 0.15, dark);
    rearBumper.position.set(0, 0.5, -1.75);
    this.group.add(body, nose, windscreen, bullbar, rearBumper);
    for (const side of [-1, 1]) {
      const sideWindow = box(0.05, 0.45, 0.5, glass);
      sideWindow.position.set(side * 0.8, 1.5, 1.0);
      const lamp = box(0.3, 0.15, 0.05, headlight);
      lamp.position.set(side * 0.55, 0.85, 1.81);
      this.group.add(sideWindow, lamp);
    }

    const decal = new THREE.MeshStandardMaterial({ map: policeLivery(), transparent: true, alphaTest: 0.4 });
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), decal);
      plate.position.set(side * 0.81, 1.15, -0.2);
      plate.rotation.y = (side * Math.PI) / 2;
      this.group.add(plate);
    }

    // Oversized roof light bar, red on the left and blue on the right, so it reads from across the reserve.
    const base = box(1.5, 0.1, 0.4, dark);
    base.position.set(0, 1.95, 0.3);
    this.group.add(base);
    for (const [side, material, glow] of [[-1, this.red, this.redGlow], [1, this.blue, this.blueGlow]] as const) {
      const lens = box(0.68, 0.24, 0.36, material);
      lens.position.set(side * 0.37, 2.12, 0.3);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), glow);
      halo.position.copy(lens.position);
      this.group.add(lens, halo);
    }
    this.siren.position.set(0, 2.6, 0.3);
    this.group.add(this.siren);

    for (const [x, z] of [[-0.8, 1.05], [0.8, 1.05], [-0.8, -1.1], [0.8, -1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10).rotateZ(Math.PI / 2), dark);
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      this.group.add(wheel);
    }
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Drive to the target, stand guard there for `linger` seconds, then return home. */
  dispatch(target: THREE.Vector3, linger: number): void {
    this.target = nav.clearSpot(target.clone(), this.radius);
    this.returning = false;
    this.linger = linger;
  }

  update(dt: number): void {
    this.time += dt;
    // Parked: both halves glow softly. Responding: red and blue alternate at full blaze with halos
    // and a coloured light washing over the ground.
    const active = this.target !== null;
    const redOn = Math.sin(this.time * 10) > 0;
    this.red.emissiveIntensity = active ? (redOn ? 2 : 0.2) : 0.5;
    this.blue.emissiveIntensity = active ? (redOn ? 0.2 : 2) : 0.5;
    this.redGlow.opacity = active && redOn ? 0.45 : 0;
    this.blueGlow.opacity = active && !redOn ? 0.45 : 0;
    this.siren.color.set(redOn ? '#ff2a2a' : '#3a6bff');
    this.siren.intensity = active ? 12 : 0;
    if (!this.target) return;
    const to = this.target.clone().sub(this.group.position).setY(0);
    const distance = to.length();
    if (distance < 0.4) {
      if (this.returning) this.target = null;
      else if (this.linger > 0) this.linger -= dt;
      else {
        this.returning = true;
        this.target = this.home.clone();
      }
      return;
    }
    const step = Math.min(distance, dt * 13);
    const dir = nav.heading(this, this.target, this.heading);
    this.group.position.addScaledVector(dir, step);
    nav.separate(this);
    this.group.position.y = heightAt(this.group.position.x, this.group.position.z);
    // Turn into the new heading quickly but not instantly, like a vehicle.
    const turn = Math.atan2(dir.x, dir.z) - this.group.rotation.y;
    this.group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-10 * dt));
  }
}
