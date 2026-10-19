import * as THREE from 'three';
import { FENCE_RADIUS, heightAt } from './terrain';
import { box, damp, polar } from './util';

const SEGMENTS = 36;

interface Segment {
  group: THREE.Group;
  angle: number;
  knock: number;
  recover: number;
  tilt: number;
}

/** The fence ring stands for the bank's controls: it shrinks as defences weaken and glows when it blocks. */
export class Fence {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ color: '#8a6a43', flatShading: true });
  private readonly segments: Segment[] = [];
  private strength = 1;
  private targetStrength = 1;
  private glow = 0;
  private readonly glowColor = new THREE.Color();
  private time = 0;
  private armedUntil = 0;

  constructor() {
    const chord = 2 * FENCE_RADIUS * Math.sin(Math.PI / SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a0) * FENCE_RADIUS, 0, Math.sin(a0) * FENCE_RADIUS);
      const p1 = new THREE.Vector3(Math.cos(a1) * FENCE_RADIUS, 0, Math.sin(a1) * FENCE_RADIUS);
      const segment = new THREE.Group();
      segment.position.set(p0.x, heightAt(p0.x, p0.z), p0.z);
      segment.rotation.order = 'YXZ'; // knock-down tilts around the rail, not the world X axis
      segment.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);

      const post = box(0.3, 2.2, 0.3, this.material);
      post.position.y = 1.1;
      segment.add(post);
      for (const y of [0.8, 1.6]) {
        const rail = box(chord, 0.12, 0.12, this.material);
        rail.position.set(chord / 2, y, 0);
        segment.add(rail);
      }
      this.group.add(segment);
      this.segments.push({ group: segment, angle: (a0 + a1) / 2, knock: 0, recover: 1, tilt: 0 });
    }
  }

  setStrength(strength: number): void {
    this.targetStrength = strength;
  }

  pulse(color: THREE.ColorRepresentation): void {
    this.glow = 1;
    this.glowColor.set(color);
  }

  /** For the next `seconds`, any intruder running through a segment knocks it down. */
  armBreach(seconds: number): void {
    this.armedUntil = this.time + seconds;
  }

  reset(): void {
    this.targetStrength = 1;
    this.armedUntil = 0;
    for (const s of this.segments) s.knock = 0;
  }

  /** Returns where segments broke this frame, so the caller can add dust and shake. */
  update(dt: number, intruders: readonly THREE.Vector3[]): THREE.Vector3[] {
    this.time += dt;
    this.strength = damp(this.strength, this.targetStrength, 3, dt);
    this.glow = damp(this.glow, 0, 0.8, dt);
    this.material.emissive.copy(this.glowColor).multiplyScalar(this.glow * 1.6);
    const armed = this.time < this.armedUntil;
    const broken: THREE.Vector3[] = [];
    for (const s of this.segments) {
      if (armed && s.knock === 0 && intruders.some((p) => crosses(s, p))) {
        s.knock = 1;
        // Stand back up shortly after the attack window closes.
        s.recover = 1 / (this.armedUntil - this.time + 2);
        broken.push(polar(s.angle, FENCE_RADIUS, s.group.position.y));
      }
      s.knock = Math.max(0, s.knock - dt * s.recover);
      s.group.scale.y = this.strength;
      // Crashes down fast, stays flat for most of the window, then springs back up in the last third.
      const target = Math.min(1, s.knock * 3) * 1.2;
      s.tilt = damp(s.tilt, target, target > s.tilt ? 14 : 4, dt);
      s.group.rotation.x = s.tilt;
    }
    return broken;
  }
}

/** True when `p` is in the fence line within this segment's span. */
function crosses(s: Segment, p: THREE.Vector3): boolean {
  if (Math.abs(Math.hypot(p.x, p.z) - FENCE_RADIUS) > 1) return false;
  const diff = Math.atan2(Math.sin(Math.atan2(p.z, p.x) - s.angle), Math.cos(Math.atan2(p.z, p.x) - s.angle));
  return Math.abs(diff) < Math.PI / SEGMENTS + 0.04;
}
