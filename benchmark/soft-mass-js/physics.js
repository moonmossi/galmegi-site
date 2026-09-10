import { Vector3 } from './vendor/three.module.min.js';

// Same semi-implicit 240 Hz substeps and forces as local_soft_patch.gd.
export class SoftMass {
  constructor() {
    Object.assign(this, { radius: .16, mass: 1, stiffness: 110, damping: 6,
      inertia: .45, upperSupport: 2, lowerSupport: .55, coupling: 3,
      strainStiffening: 6, grabStiffness: 180, held: false, limitHits: 0, samples: 0 });
    for (const key of ['upper','lower','velocity','lowerVelocity','target','acceleration',
      'previousAnchor','previousVelocity','currentVelocity','rawAcceleration','link','upperForce','lowerForce','scratch']) {
      this[key] = new Vector3();
    }
  }
  resetMotion(anchor) {
    this.samples = 0;
    this.previousAnchor.copy(anchor);
    this.previousVelocity.set(0,0,0);
    this.acceleration.set(0,0,0);
  }
  reset(anchor = this.previousAnchor) {
    this.held = false;
    for (const key of ['upper','lower','velocity','lowerVelocity','target']) this[key].set(0,0,0);
    this.limitHits = 0;
    this.resetMotion(anchor);
  }
  impulse(value) {
    this.velocity.addScaledVector(value, 1 / this.mass);
    this.lowerVelocity.addScaledVector(value, 1 / this.mass);
  }
  drag(value) { this.target.copy(value).clampLength(0, this.radius * .22); }
  advance(anchor, delta) {
    if (anchor.distanceTo(this.previousAnchor) > this.radius * 2) this.resetMotion(anchor);
    this.currentVelocity.copy(anchor).sub(this.previousAnchor).divideScalar(delta);
    if (this.samples >= 2) {
      this.rawAcceleration.copy(this.currentVelocity).sub(this.previousVelocity).divideScalar(delta);
      this.acceleration.lerp(this.rawAcceleration, 1 - Math.exp(-delta / .04));
    }
    this.previousAnchor.copy(anchor);
    this.previousVelocity.copy(this.currentVelocity);
    this.samples++;
    this.step(delta);
  }
  step(delta) {
    const steps = Math.max(1, Math.ceil(delta * 240)), dt = delta / steps, half = this.mass * .5;
    const strain = (this.radius * .15) ** 2;
    for (let i = 0; i < steps; i++) {
      this.link.copy(this.lower).sub(this.upper).multiplyScalar(this.stiffness * this.coupling)
        .addScaledVector(this.scratch.copy(this.lowerVelocity).sub(this.velocity), this.damping * .25);
      this.upperForce.copy(this.upper).multiplyScalar(-this.stiffness * this.upperSupport * .5 *
        (1 + this.strainStiffening * this.upper.lengthSq() / strain))
        .addScaledVector(this.velocity, -this.damping * .5).add(this.link);
      this.lowerForce.copy(this.lower).multiplyScalar(-this.stiffness * this.lowerSupport * .5 *
        (1 + this.strainStiffening * this.lower.lengthSq() / strain))
        .addScaledVector(this.lowerVelocity, -this.damping * .5).sub(this.link);
      if (this.held) {
        this.upperForce.addScaledVector(this.scratch.copy(this.target).sub(this.upper), this.grabStiffness * .5);
        this.lowerForce.addScaledVector(this.scratch.copy(this.target).sub(this.lower), this.grabStiffness * .5);
      }
      this.velocity.addScaledVector(this.upperForce, dt / half).addScaledVector(this.acceleration, -this.inertia * dt);
      this.lowerVelocity.addScaledVector(this.lowerForce, dt / half).addScaledVector(this.acceleration, -this.inertia * dt);
      this.upper.addScaledVector(this.velocity, dt);
      this.lower.addScaledVector(this.lowerVelocity, dt);
      this.limit(this.upper, this.velocity);
      this.limit(this.lower, this.lowerVelocity);
    }
  }
  limit(position, velocity) {
    const limit = this.radius * .22;
    if (position.lengthSq() <= limit * limit) return;
    this.limitHits++;
    position.clampLength(0, limit);
    this.scratch.copy(position).normalize();
    velocity.addScaledVector(this.scratch, -Math.max(0, velocity.dot(this.scratch)));
  }
}
