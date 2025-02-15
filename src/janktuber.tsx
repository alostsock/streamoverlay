import { useEffect, useState } from 'preact/hooks';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  useFaceDetection,
  LandmarkData,
  BlendshapeData,
  LANDMARK_NAMES,
  BLENDSHAPE_NAMES,
  DetectFaceCallback,
} from './use-face-detection';
import { deg, getCssColor } from './three-utils';

const SCALE = 10;
const BLINK_THRESHOLD = 0.45;

export function Janktuber() {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const detectFace = useFaceDetection(videoEl);
  const [landmarks, setLandmarks] = useState<LandmarkData | null>(null);
  const [blendshapes, setBlendshapes] = useState<BlendshapeData | null>(null);

  useEffect(() => {
    if (!detectFace || !containerEl) return;

    const detectFaceWrapper = () => {
      const result = detectFace();
      if (result) {
        setLandmarks(result.landmarks);
        setBlendshapes(result.blendshapes);
      }
      return result;
    };

    new Renderer(containerEl, detectFaceWrapper).render();
  }, [detectFace, containerEl]);

  return (
    <div className="Janktuber">
      <video ref={setVideoEl} autoplay style={{ display: 'none' }} />

      <div ref={setContainerEl} className="container" />

      <div className="debug">
        <pre>
          <code>{formatLandmarksDebug(landmarks)}</code>
        </pre>

        <pre>
          <code>{formatBlendshapesDebug(blendshapes)}</code>
        </pre>
      </div>
    </div>
  );
}

class Renderer {
  colors = {
    sky: getCssColor('--text-color'),
    ground: getCssColor('--text-shadow-color'),
    base: getCssColor('--text-color'),
    active: getCssColor('--orange-5'),
  };

  constructor(
    private containerEl: HTMLDivElement,
    private detectFace: DetectFaceCallback,
  ) {}

  render() {
    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    camera.position.z = 0.7 * SCALE;

    const ambientLight = new THREE.HemisphereLight(this.colors.sky, this.colors.ground, 3);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    loader.load(
      '/janktuber_v1.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(8, 8, 8);
        model.position.set(0, -4, 0);
        model.rotateY(deg(-45));
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.material = new THREE.MeshPhongMaterial({
              color: this.colors.base,
              wireframe: false,
            });
          }
        });
        const bbox = new THREE.Box3().setFromObject(model);
        console.log(bbox);
        scene.add(gltf.scene);
      },
      undefined,
      (error) => {
        console.error(error);
      },
    );

    const landmarks: Record<keyof LandmarkData, Landmark> = {
      faceTop: new Landmark(this.colors.base),
      faceLeft: new Landmark(this.colors.base),
      faceBottom: new Landmark(this.colors.base),
      faceRight: new Landmark(this.colors.base),
      eyeLeft: new Landmark(this.colors.base),
      eyeRight: new Landmark(this.colors.base),
      nose: new Landmark(this.colors.base),
      lipUpper: new Landmark(this.colors.base),
      lipLower: new Landmark(this.colors.base),
    };

    for (const name of LANDMARK_NAMES) {
      scene.add(landmarks[name].obj);
    }

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();

      const result = this.detectFace();
      if (result) {
        for (const name of LANDMARK_NAMES) {
          // Map face coords to world coords
          landmarks[name].position.x = -(-0.5 + result.landmarks[name].x) * SCALE;
          landmarks[name].position.y = (0.5 - result.landmarks[name].y) * SCALE;
          landmarks[name].position.z = result.landmarks[name].z * SCALE;
        }

        if (
          result.blendshapes.eyeBlinkLeft > BLINK_THRESHOLD ||
          result.blendshapes.eyeBlinkRight > BLINK_THRESHOLD
        ) {
          landmarks.eyeLeft.color = this.colors.active;
          landmarks.eyeRight.color = this.colors.active;
        } else {
          landmarks.eyeLeft.color = this.colors.base;
          landmarks.eyeRight.color = this.colors.base;
        }
      }

      renderer.render(scene, camera);
    };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x0, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    this.containerEl.appendChild(renderer.domElement);
  }
}

class Landmark {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  obj: THREE.Mesh;

  constructor(color: THREE.Color) {
    this.geometry = new THREE.CircleGeometry(0.2, 5);
    this.material = new THREE.MeshBasicMaterial({ color });
    this.obj = new THREE.Mesh(this.geometry, this.material);
  }

  get position() {
    return this.obj.position;
  }

  set color(color: THREE.Color) {
    this.material.color = color;
  }
}

function formatLandmarksDebug(data: LandmarkData | null) {
  if (!data) return null;

  return LANDMARK_NAMES.map((name) => {
    const coords = [data[name].x.toFixed(2), data[name].y.toFixed(2), data[name].z.toFixed(2)].join(
      ', ',
    );

    return `${name.padEnd(Math.max(...LANDMARK_NAMES.map((n) => n.length)))} ${coords}`;
  }).join('\n');
}

function formatBlendshapesDebug(data: BlendshapeData | null) {
  if (!data) return null;

  return BLENDSHAPE_NAMES.map((name) => {
    const value = data[name].toFixed(3);

    return `${name.padEnd(Math.max(...BLENDSHAPE_NAMES.map((n) => n.length)))} ${value}`;
  }).join('\n');
}
