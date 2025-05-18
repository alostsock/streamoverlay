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

export const clamp = (val: number, correction: number, min: number, max: number) => {
  const correctedVal = val + correction;
  const clamped = Math.min(Math.max(correctedVal, min), max);
  return (clamped - min) / max;
};

// https://easings.net
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
