import * as THREE from 'three';
import { REVEAL_SECONDS } from '../config';
import type { RoundResult } from '../game/scoring';
import type { Animal } from '../game/types';
import { Elephant, Herd, createPack, type Pack } from './actors/animals';
import { Fence } from './fence';
import { Helicopter } from './helicopter';
import { createFlora } from './flora';
import { Effects } from './particles';
import { Jeep, Watchtower, createStation } from './structures';
import { FENCE_RADIUS, createTerrain, heightAt } from './terrain';
import { Waterhole } from './waterhole';
import { damp, polar } from './util';

// The reserve stays in a calm golden afternoon for the whole game.
const DAY = {
  top: new THREE.Color('#4f9fdc'),
  horizon: new THREE.Color('#f6dca4'),
  sun: new THREE.Color('#fff1d6'),
  sky: new THREE.Color('#cfe6ff'),
  ground: new THREE.Color('#8a6b3c'),
  fog: new THREE.Color('#ead6a6'),
};

const STATION_POS = new THREE.Vector3(-5.3, 0, 12.2);
const TOWER_POS = new THREE.Vector3(12, 0, -8.2);
const JEEP_HOME = new THREE.Vector3(6.3, 0, 12.7);
const CLOSE_UP_DISTANCE = 24;
const CLOSE_UP_HEIGHT = 12;

/** Owns the Three.js scene and translates round results into on-screen events. */
export class Savanna {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
  private readonly sun = new THREE.DirectionalLight(DAY.sun, 2.52);
  private readonly hemi = new THREE.HemisphereLight(DAY.sky, DAY.ground, 1.08);
  private readonly skyUniforms = { top: { value: DAY.top }, horizon: { value: DAY.horizon } };
  private readonly fog = new THREE.Fog(DAY.fog, 90, 330);
  private readonly waterhole = new Waterhole();
  private readonly fence = new Fence();
  private readonly herd = new Herd();
  private readonly tower = new Watchtower(TOWER_POS);
  private readonly jeep = new Jeep(JEEP_HOME);
  private readonly effects = new Effects();
  private readonly helicopter = new Helicopter();
  private readonly elephant = new Elephant();
  private pack: Pack;
  private orbit = 0.6;
  private attract = true;
  private shake = 0;
  /** Reveal close-up: what the camera zooms to and when it pulls back out. */
  private shot: { target: () => THREE.Vector3; until: number } | null = null;
  private zoom = 0;
  private readonly timer = new THREE.Timer();

  constructor(container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.timer.connect(document);

    this.scene.fog = this.fog;
    this.scene.add(this.createSky(), this.hemi, this.sun, this.sun.target);
    this.sun.position.set(Math.cos(0.9) * 80, Math.sin(0.9) * 80, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 220 });
    this.sun.shadow.bias = -0.0005;

    const station = createStation(STATION_POS);
    station.position.y = heightAt(STATION_POS.x, STATION_POS.z);
    this.scene.add(
      createTerrain(),
      createFlora(),
      this.waterhole.group,
      this.fence.group,
      this.herd.group,
      this.tower.group,
      this.jeep.group,
      station,
      this.effects.group,
      this.helicopter.group,
      this.elephant.group,
    );
    this.pack = createPack('hyena');
    this.scene.add(this.pack.group);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Fresh reserve for a new game with the scenario's predator. */
  newGame(animal: Animal): void {
    this.scene.remove(this.pack.group);
    this.pack = createPack(animal);
    this.scene.add(this.pack.group);
    this.waterhole.reset();
    this.fence.reset();
    this.herd.reset();
    this.effects.clear();
    this.shot = null;
    this.setDanger(0.3);
  }

  setAttract(attract: boolean): void {
    this.attract = attract;
  }

  /** Lead = predator total − ranger total. */
  setScore(lead: number): void {
    this.setDanger(THREE.MathUtils.clamp(0.3 + lead / 45, 0, 1));
  }

  react(result: RoundResult): void {
    // Hold each reaction for most of the reveal, leaving time to settle before the next round.
    const hold = REVEAL_SECONDS * 0.7;
    const focus = this.pack.focus();
    const angle = this.pack.attackAngle;
    const gate = polar(angle, FENCE_RADIUS);
    const closeUp = (target: () => THREE.Vector3, seconds: number) => {
      this.shot = { target, until: this.timer.getElapsed() + seconds };
    };
    const at = (point: THREE.Vector3) => () => point;
    if (result.blocked) {
      closeUp(at(gate.clone().setY(1)), hold);
      this.fence.pulse('#38e1ff');
      this.effects.sparks(gate, '#7ff0ff');
      this.tower.alert(focus, hold);
      this.jeep.dispatch(polar(angle, FENCE_RADIUS - 1.5), hold * 0.6);
      this.pack.repel(hold);
    } else if (result.breached) {
      // Fire is the main event when it happens; otherwise follow the predators as they charge in.
      const pack = this.pack;
      closeUp(result.predator?.effect === 'burn' ? at(STATION_POS.clone().setY(1.5)) : () => pack.strikeFocus(), hold);
      this.fence.pulse('#ff3b2a');
      this.fence.armBreach(hold);
      this.pack.lunge(hold);
      // Everything that can move gets out of the predators' path: the herd bolts, and if the van
      // is near the break-in it drives clear along the fence, waits them out, then returns home.
      this.herd.scatter(angle, hold);
      const van = this.jeep.group.position;
      const vanAngle = Math.atan2(van.z, van.x);
      const offset = Math.atan2(Math.sin(vanAngle - angle), Math.cos(vanAngle - angle));
      if (Math.abs(offset) < 1.2) this.jeep.dispatch(polar(angle + (Math.sign(offset) || 1) * 1.9, FENCE_RADIUS - 2.3), hold);
      if (pack.captures) this.herd.capture(angle, () => pack.focus());
      if (result.predator?.effect === 'steal') {
        this.waterhole.pollute(0.5);
        this.effects.splash(polar(angle, 5, 0));
      }
      if (result.predator?.effect === 'burn') this.effects.burn(STATION_POS, REVEAL_SECONDS);
    } else if ((result.ranger?.score ?? 0) >= 7) {
      closeUp(at(TOWER_POS.clone().setY(4)), hold * 0.5);
      this.fence.pulse('#7dff7a');
      this.tower.alert(focus, hold * 0.5);
    }
  }

  private setDanger(danger: number): void {
    this.pack.setPressure(danger);
    this.fence.setStrength(THREE.MathUtils.lerp(1.05, 0.45, danger));
  }

  private createSky(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyUniforms,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
      }),
    );
  }

  private resize(): void {
    const { innerWidth: w, innerHeight: h } = window;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the whole fence ring in view on narrow screens.
    this.camera.fov = w / h < 1.2 ? 60 : 45;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    // Attract mode circles the reserve; in play the camera sits across the waterhole from the
    // predators so both the herd and the threat stay in frame.
    if (this.attract) this.orbit += dt * 0.06;
    else {
      const sway = Math.sin(this.timer.getElapsed() * 0.15) * 0.3;
      const goal = this.pack.attackAngle + Math.PI + sway;
      this.orbit += Math.atan2(Math.sin(goal - this.orbit), Math.cos(goal - this.orbit)) * (1 - Math.exp(-0.8 * dt));
    }
    const position = polar(this.orbit, this.attract ? 46 : 38, this.attract ? 26 : 23);
    const look = this.attract ? new THREE.Vector3() : polar(this.pack.attackAngle, 4);

    // Reveal close-up: dolly in along the current view line toward the event, hold, then pull back.
    const zoomIn = this.shot !== null && this.timer.getElapsed() < this.shot.until;
    this.zoom = damp(this.zoom, zoomIn ? 1 : 0, zoomIn ? 2.2 : 1.6, dt);
    if (this.shot) {
      const t = THREE.MathUtils.smoothstep(this.zoom, 0, 1);
      const target = this.shot.target();
      const away = position.clone().sub(target).setY(0).normalize();
      const close = target.clone().addScaledVector(away, CLOSE_UP_DISTANCE).setY(target.y + CLOSE_UP_HEIGHT);
      position.lerp(close, t);
      look.lerp(target, t);
      if (!zoomIn && this.zoom < 0.01) this.shot = null;
    }

    this.shake = damp(this.shake, 0, 4, dt);
    const jolt = this.shake * 0.6;
    this.camera.position.copy(position).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(jolt));
    this.camera.lookAt(look);

    this.waterhole.update(dt, this.timer.getElapsed(), this.camera.position);
    for (const at of this.fence.update(dt, this.pack.positions())) {
      this.effects.dust(at, 25);
      this.shake = Math.max(this.shake, 0.7);
    }
    this.herd.update(dt);
    this.pack.update(dt);
    this.tower.update(dt);
    this.jeep.update(dt);
    this.effects.update(dt);
    this.helicopter.update(dt);
    this.elephant.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
