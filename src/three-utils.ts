import * as THREE from 'three';

export const DEBUG = false;

export const POSTPROCESSING_MODE: 'pixel' | 'normal' = 'normal';
export const PIXEL_SIZE = 3;

const getCssColor = (colorVar: string, el: HTMLElement = document.documentElement) => {
  const cssColor = window.getComputedStyle(el).getPropertyValue(colorVar);
  const hex = parseInt(cssColor.replace('#', ''), 16);
  return new THREE.Color().setHex(hex);
};

export const COLORS = {
  sky: getCssColor('--text-color'),
  ground: getCssColor('--text-shadow-color'),
  base: getCssColor('--text-color'),
  active: getCssColor('--active-color'),
  accent: getCssColor('--accent-color'),
};

export const deg = (x: number) => (x * 2 * Math.PI) / 360;

export const rand = (min: number, max: number) => min + (max - min) * Math.random();

export /**
 * Returns the shortest vector from a bounding box to a point.
 * This assumes the point is inside the bounding box.
 * Returns `null` if the point is more than `maxDistance` away from the bounding box.
 */
const getBoundingBoxToPointVec = (
  boundingBox: THREE.Box3,
  point: THREE.Vector3,
  maxDistance: number,
) => {
  let minDistance = maxDistance;
  let minSide: 'min' | 'max' = 'min';
  let minAxis: 'x' | 'y' | 'z' = 'x';

  for (const side of ['min', 'max'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      let distance: number;
      if (side === 'min') {
        distance = point[axis] - boundingBox[side][axis];
      } else {
        distance = boundingBox[side][axis] - point[axis];
      }

      if (distance > 0 && distance < maxDistance && distance < minDistance) {
        minDistance = distance;
        minSide = side;
        minAxis = axis;
      }
    }
  }

  if (minDistance === maxDistance) {
    // Not close to bounding box
    return null;
  } else {
    const vec = new THREE.Vector3();
    vec[minAxis] = minSide === 'min' ? minDistance : -minDistance;
    return vec;
  }
};
