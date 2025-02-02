import * as THREE from 'three';

const DEBUG = false;

const deg = (x: number) => (x * 2 * Math.PI) / 360;

const rand = (min: number, max: number) => min + (max - min) * Math.random();

const color = (colorVar: string, el: HTMLElement = document.documentElement) => {
  const cssColor = window.getComputedStyle(el).getPropertyValue(colorVar);
  return new THREE.Color().setStyle(cssColor);
};

/**
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
  let minSide = 'min';
  let minAxis = 'x';

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

export class Flock {
  birbs: Birb[];

  boundingBox = new THREE.Box3(
    new THREE.Vector3(-500, -150, -200),
    new THREE.Vector3(500, 300, 50),
  );

  colors = {
    sky: color('--text-color'),
    ground: color('--text-shadow-color'),
    birb: color('--text-color'),
  } as const;

  constructor(
    public containerEl: HTMLDivElement,
    count = 30,
  ) {
    this.birbs = new Array(count)
      .fill(null)
      .map(() => new Birb(this.colors.birb, this.boundingBox));
  }

  private update(delta: number) {
    for (const birb of this.birbs) {
      birb.update(delta, this.boundingBox);
    }
  }

  render() {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    camera.position.z = 300;
    camera.position.y = 0;
    camera.rotateX(deg(5)); // gaze slightly upward

    const ambientLight = new THREE.HemisphereLight(this.colors.sky, this.colors.ground, 3);
    scene.add(ambientLight);

    if (DEBUG) {
      const helper = new THREE.Box3Helper(this.boundingBox, 0x997700);
      scene.add(helper);
    }

    for (const birb of this.birbs) {
      scene.add(birb.obj);
    }

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      this.update(delta);
      renderer.render(scene, camera);
    };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x0, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    this.containerEl.appendChild(renderer.domElement);

    if (import.meta.hot) {
      // Handle HMR, since preact won't (and shouldn't) rerender this
      import.meta.hot.accept((newModule) => {
        if (newModule) {
          renderer.setAnimationLoop(null);
          while (this.containerEl.children.length > 0) {
            this.containerEl.removeChild(this.containerEl.firstChild);
          }
          const NewFlock: typeof Flock = newModule.Flock;
          new NewFlock(this.containerEl).render();
        }
      });
    }
  }
}

export class Birb {
  obj: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  accel = new THREE.Vector3(0, 0, 0);

  private maxSpeed = 100;
  private detectionRange = 150;
  private collisionWeight = 1.5;

  constructor(color: THREE.ColorRepresentation, boundingBox: THREE.Box3) {
    this.obj = this.createBirbMesh(color);
    this.obj.position.set(
      rand(boundingBox.min.x, boundingBox.max.x),
      rand(boundingBox.min.y, boundingBox.max.y),
      rand(boundingBox.min.z, boundingBox.max.z),
    );
    this.velocity = new THREE.Vector3().randomDirection().multiplyScalar(this.maxSpeed);
    // this.velocity = new THREE.Vector3(0, -this.maxSpeed, 0);
    this.obj.lookAt(this.obj.position.clone().add(this.velocity));
  }

  update(delta: number, boundingBox: THREE.Box3) {
    const collisionVec = getBoundingBoxToPointVec(
      boundingBox,
      this.obj.position,
      this.detectionRange,
    );
    if (collisionVec) {
      // The collision should have minimal effect at max detection range
      const collisionFactor = 1 - Math.pow(collisionVec.length() / this.detectionRange, 2);
      // The acceleration magnitude is a factor of velocity and collisionWeight.
      // acceleration direction is directly away from the bounding box.
      const accelVec = collisionVec
        .normalize()
        .multiplyScalar(this.velocity.length() * this.collisionWeight * collisionFactor);
      this.velocity.addScaledVector(accelVec, delta);
    }

    this.velocity.clampLength(0, this.maxSpeed);
    this.obj.position.addScaledVector(this.velocity, delta);
    this.obj.lookAt(this.obj.position.clone().add(this.velocity));
  }

  private createBirbMesh(color: THREE.ColorRepresentation) {
    // vertices roughly from
    // https://github.com/mrdoob/three.js/blob/79497a2c9b86036cfcc0c7ed448574f2d62de64d/examples/webgl_gpgpu_birds.html#L365

    // prettier-ignore
    const positions = new Float32Array([
      // body
      0, 0, 14,
      0, -4, 5,
      0, 0, -14,
      // // left wing
      0, -1, 8,
      -16, -1, 5,
      0, -1, -3,
      // // right wing
      0, -1, 8,
      16, -1, 5,
      0, -1, -3,
    ]);

    // prettier-ignore
    const normals = new Float32Array([
      // body
      -1, 0, 0,
      -1, 0, 0,
      -1, 0, 0,
      // // left wing
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      // // right wing
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.scale(2.0, 2.0, 2.0);

    const material = new THREE.MeshPhongMaterial({
      color,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    return new THREE.Mesh(geometry, material);
  }
}
