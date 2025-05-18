export const smoothed = (fn: (input: number) => number, depth = 3) => {
  const prevOutputs: number[] = [];

  return (input: number) => {
    const output = fn(input);
    prevOutputs.push(output);
    if (prevOutputs.length > depth) {
      prevOutputs.shift();
    }
    return prevOutputs.reduce((prev, curr) => prev + curr, 0) / prevOutputs.length;
  };
};

export const throttledBlink = (blinkThreshold = 0.6, duration = 150, interval = 500) => {
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

export const clamp = (val: number, correction: number, min: number, max: number) => {
  const correctedVal = val + correction;
  const clamped = Math.min(Math.max(correctedVal, min), max);
  return (clamped - min) / (max - min);
};

// https://easings.net
export function easeInQuad(x: number): number {
  return x * x;
}
export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
export function easeInOutElastic(x: number): number {
  const c5 = (2 * Math.PI) / 4.5;

  return x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}
