import { useState, useEffect } from 'preact/hooks';
import * as THREE from 'three';

import { Backgrounded } from './backgrounded';
import {
  DEBUG,
  COLORS,
  POSTPROCESSING_MODE,
  PIXEL_SIZE,
  deg,
  rand,
  getBoundingBoxToPointVec,
} from './three-utils';
import {
  EffectComposer,
  OutputPass,
  RenderPass,
  RenderPixelatedPass,
} from 'three/examples/jsm/Addons.js';

const SCALE = 2.2;

export function Birbs({
  count,
  cameraVerticalAdjustment,
}: {
  count?: number;
  cameraVerticalAdjustment?: number;
}) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerEl) return;

    new Flock(containerEl, count, cameraVerticalAdjustment).render();
  }, [containerEl]);

  return (
    <Backgrounded pattern="lines" gradient className="Birbs">
      <div ref={setContainerEl} className="container" />
    </Backgrounded>
  );
}

class Flock {
  birbs: Birb[];

  boundingBox = new THREE.Box3(new THREE.Vector3(-400, 0, -500), new THREE.Vector3(1000, 800, 150));

  constructor(
    private containerEl: HTMLDivElement,
    private count = 50,
    private cameraVerticalAdjustment = 0,
  ) {
    this.birbs = new Array(count).fill(null).map(() => new Birb(COLORS.base, this.boundingBox));
  }

  private update(delta: number) {
    for (const birb of this.birbs) {
      const neighbors = this.birbs
        .filter(
          (neighborCandidate) =>
            birb !== neighborCandidate &&
            birb.obj.position.distanceTo(neighborCandidate.obj.position) < birb.detectionRange,
        )
        .slice(0, this.count / 10); // Just take a sample
      birb.update(delta, this.boundingBox, neighbors);

      if (DEBUG && Math.random() < 0.005 / this.count) {
        const birbsOutside = this.birbs.filter(
          (b) => !this.boundingBox.containsPoint(b.obj.position),
        );
        console.log(`birbs outside bounding box: ${birbsOutside.length}`);
      }
    }
  }

  render() {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1400);
    camera.position.z = 300;
    camera.position.y = this.cameraVerticalAdjustment;
    // gaze upward and to the right
    camera.setRotationFromAxisAngle(new THREE.Vector3(0.75, -1.5, 0), deg(15));

    const ambientLight = new THREE.HemisphereLight(COLORS.sky, COLORS.ground, 3);
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
      composer.render();
    };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x0, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    this.containerEl.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    if (POSTPROCESSING_MODE === 'pixel') {
      composer.addPass(new RenderPixelatedPass(PIXEL_SIZE, scene, camera));
    } else {
      composer.addPass(new RenderPass(scene, camera));
    }
    composer.addPass(new OutputPass());

    if (import.meta.hot) {
      import.meta.hot.accept((newModule) => {
        if (newModule) {
          renderer.setAnimationLoop(null);
          while (this.containerEl.firstChild) {
            this.containerEl.removeChild(this.containerEl.firstChild);
          }
          const NewFlock: typeof Flock = newModule.Flock;
          new NewFlock(this.containerEl, this.count, this.cameraVerticalAdjustment).render();
        }
      });
    }
  }
}

export class Birb {
  obj: THREE.Mesh;
  velocity: THREE.Vector3;
  accel = new THREE.Vector3(0, 0, 0);

  detectionRange = 400;

  private maxSpeed = 145;
  private cohesionMult = 0.5;
  private alignmentMult = 1.2;
  private separationDistanceMult = 0.1;
  private separationMult = 0.0003;
  private boundaryDistanceMult = 0.3;
  private boundarySteeringMult = 2.5;
  private underspeedMult = 5;

  constructor(color: THREE.ColorRepresentation, boundingBox: THREE.Box3) {
    this.obj = this.createBirbMesh(color);
    this.obj.position.set(
      rand(boundingBox.min.x, boundingBox.max.x),
      rand(boundingBox.min.y, boundingBox.max.y),
      rand(boundingBox.min.z, boundingBox.max.z),
    );
    this.velocity = new THREE.Vector3().randomDirection().multiplyScalar(this.maxSpeed);
    this.obj.lookAt(this.obj.position.clone().add(this.velocity));
  }

  // This is all completely improvised but it seems to work
  update(delta: number, boundingBox: THREE.Box3, neighbors: Birb[]) {
    if (neighbors.length > 0) {
      let avgPosition = new THREE.Vector3(0, 0, 0);
      let avgHeading = new THREE.Vector3(0, 0, 0);
      for (const birb of neighbors) {
        avgPosition.add(birb.obj.position);
        avgHeading.add(birb.velocity.clone().normalize());
      }
      avgPosition.divideScalar(neighbors.length);
      avgHeading.divideScalar(neighbors.length).normalize();

      const cohesionDisplacement = avgPosition.clone().sub(this.obj.position);
      const cohesionAccel = this.getSteeringAccel(
        cohesionDisplacement,
        this.detectionRange,
        this.cohesionMult,
      );
      this.velocity.addScaledVector(cohesionAccel, delta);

      const headingDifference = avgHeading.sub(this.velocity.clone().normalize());
      const alignmentAccel = this.getSteeringAccel(headingDifference, 1, this.alignmentMult);
      this.velocity.addScaledVector(alignmentAccel, delta);

      // TODO: Resample closest neigbors using separationDistance instead of detectionRange
      const separationDistance = this.detectionRange * this.separationDistanceMult;
      const separationMult = this.getSteeringAccel(
        avgPosition.negate(),
        separationDistance,
        this.separationMult,
      );
      this.velocity.addScaledVector(separationMult, delta);
    }

    if (!boundingBox.containsPoint(this.obj.position)) {
      // Try to get the birb back into the box
      const boundingBoxCenter = new THREE.Vector3();
      boundingBox.getCenter(boundingBoxCenter);
      const displacement = boundingBoxCenter.clone().sub(this.obj.position);
      const centerAccel = this.getSteeringAccel(
        displacement,
        displacement.length() * 2,
        this.boundarySteeringMult,
      );
      this.velocity.addScaledVector(centerAccel, delta);
    } else {
      // Try to keep the birb in the box
      const boundaryDistance = this.detectionRange * this.boundaryDistanceMult;
      const boundaryDisplacement = getBoundingBoxToPointVec(
        boundingBox,
        this.obj.position,
        boundaryDistance,
      );
      if (boundaryDisplacement) {
        const collisionAccel = this.getSteeringAccel(
          boundaryDisplacement,
          boundaryDistance,
          this.boundarySteeringMult,
        );
        this.velocity.addScaledVector(collisionAccel, delta);
      }
    }

    if (this.velocity.length() < this.maxSpeed) {
      this.velocity.addScaledVector(this.velocity.clone().normalize(), this.underspeedMult * delta);
    }

    this.velocity.clampLength(0, this.maxSpeed);
    this.obj.position.addScaledVector(this.velocity, delta);
    this.obj.lookAt(this.obj.position.clone().add(this.velocity));
  }

  private getSteeringAccel(displacement: THREE.Vector3, detectionRange: number, factor: number) {
    // The steering should have minimal effect at max range, and a greater effect up close
    const steerFactor = 1 - Math.pow(displacement.length() / detectionRange, 2);
    // The acceleration magnitude is a factor of velocity and collisionWeight.
    // Acceleration direction matches that of displacement.
    return displacement.normalize().multiplyScalar(this.velocity.length() * steerFactor * factor);
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
    geometry.scale(SCALE, SCALE, SCALE);

    const material = new THREE.MeshPhongMaterial({
      color,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    return new THREE.Mesh(geometry, material);
  }
}
