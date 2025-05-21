import * as THREE from 'three';

export const clamp = (val: number, correction: number, min: number, max: number) => {
  const correctedVal = val + correction;
  const clamped = Math.min(Math.max(correctedVal, min), max);
  return (clamped - min) / (max - min);
};

export const smoothed = (maxDepth: number) => {
  const history: number[] = [];

  return (input: number) => {
    history.push(input);
    if (history.length > maxDepth) {
      history.shift();
    }
    return history.reduce((prev, curr) => prev + curr, 0) / history.length;
  };
};

export const averagePointEstimator = () => {
  const bb = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  const center = new THREE.Vector3();

  return (p: THREE.Vector3) => {
    bb.expandByPoint(p);
    bb.getCenter(center);
    return center;
  };
};

export const blinkAnimation = (blinkThreshold = 0.6, duration = 150, interval = 1000) => {
  let start = performance.now();

  return (input: number) => {
    const shouldStart = input > blinkThreshold;
    const now = performance.now();
    let elapsed = now - start;

    // Don't restart the animation too soon
    if (shouldStart && elapsed > interval) {
      start = now;
      elapsed = 0;
    }

    const progress = Math.min(elapsed / duration, 1.0);

    if (progress < 0.5) {
      // First half of blink; eye is closing
      return easeInOutQuad(progress / 0.5);
    } else {
      // Second half; eye is opening
      return easeInOutQuad(1 - (progress - 0.5) / 0.5);
    }
  };
};

export const deadPoseAnimation = (
  targetEyeMorph: number,
  targetJawAngle: number,
  targetPosition: THREE.Vector3,
  targetRotation: THREE.Vector3,
  dyingDelay = 700,
  duration = 700,
) => {
  let prevIsAlive = false;
  let start = performance.now();
  let offset = 0;

  return (
    isAlive: boolean,
    eyeMorph: number,
    jawAngle: number,
    position: THREE.Vector3,
    rotation: THREE.Vector3,
  ) => {
    const now = performance.now();
    const elapsed = now - start + offset;
    const delay = isAlive ? 0 : dyingDelay;

    if ((isAlive && !prevIsAlive) || (!isAlive && prevIsAlive)) {
      prevIsAlive = isAlive;
      start = now;

      if (isAlive && elapsed > delay && elapsed < delay + duration) {
        // mid-dying animation; attempt to continue where we left off
        offset = delay + duration - elapsed;
      } else {
        offset = 0;
      }
    }

    if (elapsed == 0 || elapsed < delay) {
      // not ready to transition
      return null;
    }

    const progress = clamp((elapsed - delay + offset) / duration, 0, 0, 1);
    const ratio = easeOutExpo(progress);
    const reverse = isAlive;
    const applyRatio = (a: number, b: number) =>
      reverse ? ratio * a + (1 - ratio) * b : (1 - ratio) * a + ratio * b;

    return {
      eyeMorph: applyRatio(eyeMorph, targetEyeMorph),
      jawAngle: applyRatio(jawAngle, targetJawAngle),
      displacement: new THREE.Vector3(
        applyRatio(position.x, targetPosition.x),
        applyRatio(position.y, targetPosition.y),
        applyRatio(position.z, targetPosition.z),
      ),
      rotation: new THREE.Vector3(
        applyRatio(rotation.x, targetRotation.x),
        applyRatio(rotation.y, targetRotation.y),
        applyRatio(rotation.z, targetRotation.z),
      ),
    };
  };
};

export const tailAnimation = (duration = 2000, speedChangeInterval = 1300) => {
  const start = performance.now();

  return () => {
    const now = performance.now();
    const elapsed = now - start;
    const progress = (elapsed % duration) / duration;

    if (progress < 0.5) {
      return easeInOutQuad(progress / 0.5) * 2 - 1;
    } else {
      return -1 * (easeInOutQuad((progress - 0.5) / 0.5) * 2 - 1);
    }
  };
};

// https://easings.net
export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
export function easeOutCirc(x: number): number {
  return Math.sqrt(1 - Math.pow(x - 1, 2));
}
export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
