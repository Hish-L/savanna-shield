import * as THREE from 'three';
import type { Animal } from '../../game/types';
import { FENCE_RADIUS, WATER_RADIUS, heightAt } from '../terrain';
import { canvasTexture, damp, polar } from '../util';
import { crocodile, elephant, hyena, poacher, zebra, type Model } from './models';

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

const ANIMAL_SCALE = 1.05;

/** Moves a four-legged model across the ground toward a target, swinging its legs as it goes. */
class Walker {
  readonly target: THREE.Vector3;
  speed = 1;
  moving = false;
  private gait = Math.random() * 10;

  constructor(readonly model: Model, position: THREE.Vector3) {
    model.root.position.copy(position);
    model.root.scale.multiplyScalar(ANIMAL_SCALE);
    this.target = position.clone();
  }

  get position(): THREE.Vector3 {
    return this.model.root.position;
  }

  moveTo(target: THREE.Vector3, speed: number): void {
    this.target.copy(target);
    this.speed = speed;
  }

  update(dt: number, idleFacing: THREE.Vector3 | null): void {
    const pos = this.position;
    const dx = this.target.x - pos.x;
    const dz = this.target.z - pos.z;
    const distance = Math.hypot(dx, dz);
    this.moving = distance > 0.15;
    if (this.moving) {
      const step = Math.min(distance, this.speed * dt);
      pos.x += (dx / distance) * step;
      pos.z += (dz / distance) * step;
      this.model.root.rotation.y = dampAngle(this.model.root.rotation.y, Math.atan2(dx, dz), 8, dt);
      this.gait += step * 3.2;
    } else if (idleFacing) {
      const heading = Math.atan2(idleFacing.x - pos.x, idleFacing.z - pos.z);
      this.model.root.rotation.y = dampAngle(this.model.root.rotation.y, heading, 2, dt);
    }
    const swing = this.moving ? Math.min(0.7, 0.25 + this.speed * 0.06) : 0;
    this.model.legs.forEach((leg, i) => {
      leg.rotation.x = damp(leg.rotation.x, Math.sin(this.gait + (i < this.model.legs.length / 2 ? 0 : Math.PI)) * swing, 20, dt);
    });
    pos.y = heightAt(pos.x, pos.z);
  }
}

const HERD_MIN = WATER_RADIUS + 1.2;
const HERD_MAX = FENCE_RADIUS - 1.2;

interface Grazer {
  walker: Walker;
  home: THREE.Vector3;
  nextWander: number;
  calmAt: number;
  /** Set while poachers have this zebra: it trails behind them instead of grazing. */
  captor: (() => THREE.Vector3) | null;
  slot: number;
}

const MIN_FREE_ZEBRAS = 4;

/** Zebra herd = customers. Grazes around the waterhole and bolts when predators break in. */
export class Herd {
  readonly group = new THREE.Group();
  private readonly zebras: Grazer[] = [];
  private time = 0;

  constructor(count = 9) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const home = polar(angle, THREE.MathUtils.lerp(HERD_MIN, HERD_MAX, Math.random()));
      const walker = new Walker(zebra(), home);
      walker.model.root.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(walker.model.root);
      this.zebras.push({ walker, home, nextWander: Math.random() * 4, calmAt: 0, captor: null, slot: 0 });
    }
  }

  /** Bolt away from the attack and stay alert (heads up) for `seconds`. */
  scatter(fromAngle: number, seconds: number): void {
    for (const z of this.zebras) {
      if (z.captor) continue;
      const angle = Math.atan2(z.walker.position.z, z.walker.position.x);
      const away = Math.sign(Math.sin(angle - fromAngle)) || 1;
      const radius = THREE.MathUtils.lerp(HERD_MIN + 0.8, HERD_MAX, Math.random());
      z.walker.moveTo(polar(angle + away * (1.1 + Math.random() * 0.6), radius), 7 + Math.random() * 2);
      z.calmAt = this.time + seconds;
      z.nextWander = z.calmAt + 2 + Math.random() * 3;
    }
  }

  /**
   * Poachers take the free zebra closest to their attack and lead it away for the rest of the
   * game. A few always stay free so the herd never empties.
   */
  capture(fromAngle: number, captor: () => THREE.Vector3): void {
    const free = this.zebras.filter((z) => !z.captor);
    if (free.length <= MIN_FREE_ZEBRAS) return;
    const gate = polar(fromAngle, FENCE_RADIUS);
    const nearest = free.reduce((a, b) => (a.walker.position.distanceTo(gate) < b.walker.position.distanceTo(gate) ? a : b));
    nearest.captor = captor;
    nearest.slot = this.zebras.length - free.length;
  }

  /** Every zebra back home and free for a new game. */
  reset(): void {
    for (const z of this.zebras) {
      z.captor = null;
      z.walker.position.copy(z.home);
      z.walker.moveTo(z.home, 1);
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const z of this.zebras) {
      if (z.captor) {
        // Held just behind the poachers (further from the waterhole), side by side if several.
        const leader = z.captor();
        const angle = Math.atan2(leader.z, leader.x) + (z.slot - 1) * 0.1;
        z.walker.moveTo(polar(angle, Math.hypot(leader.x, leader.z) + 3), 6);
        z.walker.update(dt, null);
        z.walker.model.head!.rotation.x = damp(z.walker.model.head!.rotation.x, 0.9, 3, dt);
        continue;
      }
      if (this.time > z.nextWander) {
        const angle = Math.atan2(z.walker.position.z, z.walker.position.x) + (Math.random() - 0.5) * 0.6;
        z.walker.moveTo(polar(angle, THREE.MathUtils.lerp(HERD_MIN, HERD_MAX, Math.random())), 0.9);
        z.nextWander = this.time + 4 + Math.random() * 6;
      }
      z.walker.update(dt, null);
      // Calm zebras lower their heads to graze or drink.
      const head = z.walker.model.head!;
      const grazing = !z.walker.moving && this.time > z.calmAt ? 1.1 + Math.sin(this.time + z.nextWander) * 0.2 : 0.35;
      head.rotation.x = damp(head.rotation.x, grazing, 3, dt);
    }
  }
}

/** The attacker on the map. Pressure (0–1) sets how close it circles; lunge and repel are timed reactions. */
export interface Pack {
  readonly group: THREE.Group;
  readonly attackAngle: number;
  /** Where the camera should look while an attack lands. */
  strikeFocus(): THREE.Vector3;
  /** Poachers hunt: a successful attack captures a zebra. */
  readonly captures: boolean;
  setPressure(pressure: number): void;
  lunge(seconds: number): void;
  repel(seconds: number): void;
  focus(): THREE.Vector3;
  /** Live member positions (the fence uses these to break where they cross). */
  positions(): THREE.Vector3[];
  update(dt: number): void;
}

type PackState = 'prowl' | 'lunge' | 'repel';
const CENTER = new THREE.Vector3();

class GroundPack implements Pack {
  readonly group = new THREE.Group();
  readonly attackAngle = Math.random() * Math.PI * 2;
  private readonly members: { walker: Walker; offset: number; jitter: number }[] = [];
  private pressure = 0.3;
  private state: PackState = 'prowl';
  private stateTime = 0;
  private time = 0;

  constructor(
    build: () => Model,
    count: number,
    private readonly pace: number,
    readonly captures = false,
  ) {
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 0.22;
      const walker = new Walker(build(), polar(this.attackAngle + offset, 60));
      this.group.add(walker.model.root);
      this.members.push({ walker, offset, jitter: Math.random() * 3 });
    }
  }

  setPressure(pressure: number): void {
    this.pressure = pressure;
  }

  lunge(seconds: number): void {
    this.state = 'lunge';
    this.stateTime = seconds;
  }

  repel(seconds: number): void {
    this.state = 'repel';
    this.stateTime = seconds;
  }

  focus(): THREE.Vector3 {
    const c = new THREE.Vector3();
    for (const m of this.members) c.add(m.walker.position);
    return c.divideScalar(this.members.length).setY(0);
  }

  strikeFocus(): THREE.Vector3 {
    return this.focus().setY(1);
  }

  positions(): THREE.Vector3[] {
    return this.members.map((m) => m.walker.position);
  }

  update(dt: number): void {
    this.time += dt;
    this.stateTime -= dt;
    if (this.stateTime <= 0) this.state = 'prowl';
    const prowlRadius = THREE.MathUtils.lerp(40, FENCE_RADIUS + 3, this.pressure);
    this.members.forEach((m, i) => {
      const angle = this.attackAngle + m.offset + Math.sin(this.time * 0.25 + i) * 0.06;
      let radius = prowlRadius + m.jitter + Math.sin(this.time * 0.4 + i * 2) * 1.2;
      let speed = this.pace;
      if (this.state === 'lunge') {
        radius = HERD_MAX - 0.5 + m.jitter * 0.4;
        speed = this.pace * 4.5;
      } else if (this.state === 'repel') {
        radius = prowlRadius + 18;
        speed = this.pace * 3;
      }
      m.walker.moveTo(polar(angle, radius), speed);
      m.walker.update(dt, CENTER);
    });
  }
}

export function createPack(animal: Animal): Pack {
  if (animal === 'hyena') return new GroundPack(hyena, 5, 2.4);
  if (animal === 'crocodile') return new GroundPack(crocodile, 4, 1.6);
  return new GroundPack(poacher, 4, 2.2, true);
}

// Easter egg: an elephant ambles around outside the fence and every so often stops, lifts its
// trunk toward the reserve and gives a security reminder.
const ELEPHANT_RING = [26, 42];
const FIRST_GREETING = 15;
const GREETING_GAP = [25, 45];
const GREETING_SECONDS = 5;

function speechBubble(lines: string[]): THREE.Sprite {
  // Drawn in a 512 x 256 space on a square canvas; the sprite is scaled 2:1 to undo the stretch.
  const texture = canvasTexture(512, (ctx) => {
    ctx.scale(1, 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1f1c4f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 170, 48);
    ctx.moveTo(230, 182);
    ctx.lineTo(256, 240);
    ctx.lineTo(282, 182);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(226, 170, 60, 14); // hide the outline where the tail joins the bubble
    const size = 56;
    ctx.font = `900 ${size}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#da1710';
    lines.forEach((line, i) => ctx.fillText(line, 256, 101 + (i - (lines.length - 1) / 2) * size * 1.15, 440));
  });
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }));
  bubble.center.set(0.5, 0);
  bubble.renderOrder = 10;
  bubble.visible = false;
  return bubble;
}

export class Elephant {
  readonly group = new THREE.Group();
  private readonly walker = new Walker(elephant(), polar(Math.random() * Math.PI * 2, 34));
  private readonly bubble = speechBubble(['Never forget', 'to update']);
  private untilGreeting = FIRST_GREETING;
  private talking = 0;
  private pop = 0;

  constructor() {
    this.group.add(this.walker.model.root, this.bubble);
    this.wander();
  }

  /** Stroll to a nearby point on the ring rather than cutting across the reserve. */
  private wander(): void {
    const { x, z } = this.walker.position;
    const angle = Math.atan2(z, x) + (Math.random() - 0.5) * 0.8;
    this.walker.moveTo(polar(angle, THREE.MathUtils.lerp(ELEPHANT_RING[0], ELEPHANT_RING[1], Math.random())), 1.3);
  }

  update(dt: number): void {
    this.untilGreeting -= dt;
    if (this.talking > 0) {
      this.talking -= dt;
      if (this.talking <= 0) this.wander();
    } else if (this.untilGreeting <= 0) {
      this.talking = GREETING_SECONDS;
      this.untilGreeting = GREETING_SECONDS + THREE.MathUtils.lerp(GREETING_GAP[0], GREETING_GAP[1], Math.random());
      this.walker.moveTo(this.walker.position, 0);
    } else if (!this.walker.moving) this.wander();

    const talking = this.talking > 0;
    this.walker.update(dt, talking ? CENTER : null);
    const head = this.walker.model.head!;
    head.rotation.x = damp(head.rotation.x, talking ? -0.5 : 0, 4, dt);
    this.pop = damp(this.pop, talking ? 1 : 0, 12, dt);
    this.bubble.visible = this.pop > 0.02;
    this.bubble.scale.set(11 * this.pop, 5.5 * this.pop, 1);
    this.bubble.position.copy(this.walker.position).setY(this.walker.position.y + 4.2);
  }
}
