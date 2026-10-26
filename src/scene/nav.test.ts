import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { nav, type Body } from './nav';
import { WATER_RADIUS } from './terrain';

/** Walks `body` toward `to` in small steps the way the movers do; returns the closest it got to the pond's centre. */
function walk(body: Body, to: THREE.Vector3, steps = 2000): number {
  const dir = new THREE.Vector3();
  let closest = Infinity;
  for (let i = 0; i < steps && Math.hypot(to.x - body.position.x, to.z - body.position.z) > 0.1; i++) {
    nav.heading(body, to, dir);
    const step = Math.min(0.05, Math.hypot(to.x - body.position.x, to.z - body.position.z));
    body.position.addScaledVector(dir, step);
    nav.separate(body);
    closest = Math.min(closest, Math.hypot(body.position.x, body.position.z));
  }
  return closest;
}

describe('navigation', () => {
  it('walks round the pond instead of through it', () => {
    const body = { position: new THREE.Vector3(-13, 0, 0.5), radius: 0.7 };
    const to = new THREE.Vector3(13, 0, -0.5);
    const closest = walk(body, to);
    expect(closest).toBeGreaterThan(WATER_RADIUS);
    expect(body.position.distanceTo(to)).toBeLessThan(0.2);
  });

  it('moves a destination that sits inside an obstacle to its edge', () => {
    nav.addObstacle(new THREE.Vector3(30, 0, 30), 2);
    const spot = nav.clearSpot(new THREE.Vector3(30.5, 0, 30), 0.5);
    expect(Math.hypot(spot.x - 30, spot.z - 30)).toBeGreaterThanOrEqual(2.5);
  });

  it('pushes overlapping movers apart', () => {
    const a = { position: new THREE.Vector3(40, 0, 0), radius: 0.7 };
    const b = { position: new THREE.Vector3(40.3, 0, 0), radius: 0.7 };
    nav.addMover(a);
    nav.addMover(b);
    for (let i = 0; i < 10; i++) {
      nav.separate(a);
      nav.separate(b);
    }
    expect(a.position.distanceTo(b.position)).toBeGreaterThan(1.3);
    nav.removeMover(a);
    nav.removeMover(b);
  });
});
