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
import { DEBUG, deg, getCssColor } from './three-utils';
import {
  clamp,
  easeInOutQuad,
  easeOutCubic,
  smoothed,
  throttledBlink,
} from './interpolation-utils';

const SCALE = 10;
const BLINK_THRESHOLD = 0.55;

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

      {DEBUG && (
        <div className="debug">
          <pre>
            <code>{formatLandmarksDebug(landmarks)}</code>
          </pre>

          <pre>
            <code>{formatBlendshapesDebug(blendshapes)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

type ModelBones = {
  tail: THREE.Bone[];
  body: THREE.Bone[];
  muzzle: THREE.Bone;
  jaw: THREE.Bone;
  earL: THREE.Bone;
  earR: THREE.Bone;
  eyeL: THREE.Bone;
  eyeR: THREE.Bone;
};

type BoneSettings = Record<string, { position: THREE.Vector3; rotation: THREE.Euler }>;

class Renderer {
  colors = {
    sky: getCssColor('--text-color'),
    ground: getCssColor('--text-shadow-color'),
    base: getCssColor('--text-color'),
    active: getCssColor('--orange-6'),
    accent: getCssColor('--orange-5'),
  };

  constructor(
    private containerEl: HTMLDivElement,
    private detectFace: DetectFaceCallback,
  ) {}

  render() {
    if (this.containerEl.children.length > 1) {
      location.reload();
    }

    console.log('starting model render loop');

    const width = this.containerEl.clientWidth;
    const height = this.containerEl.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 40);
    camera.position.z = 1.6 * SCALE;
    camera.rotateX(deg(-10));

    const ambientLight = new THREE.HemisphereLight(this.colors.sky, this.colors.ground, 3);
    scene.add(ambientLight);

    let eyeLMesh: THREE.SkinnedMesh | null = null;
    let eyeRMesh: THREE.SkinnedMesh | null = null;
    let modelBones: ModelBones | null = null;
    let initialBoneSettings: BoneSettings | null = null;
    this.loadModel((model, bones, boneSettings) => {
      const eyeL = model.getObjectByName('EyeL');
      if (eyeL && eyeL instanceof THREE.SkinnedMesh) {
        eyeLMesh = eyeL;
      }
      const eyeR = model.getObjectByName('EyeR');
      if (eyeR && eyeR instanceof THREE.SkinnedMesh) {
        eyeRMesh = eyeR;
      }

      modelBones = bones;
      initialBoneSettings = boneSettings;
      scene.add(model);
    });

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

    const faceOrigin = new Landmark(this.colors.accent, 0.3, 4);
    let faceUpward = new THREE.Vector3();
    let faceForward = new THREE.Vector3();

    const modelBaseOrigin = new Landmark(this.colors.accent, 1.5, 4);

    if (DEBUG) {
      for (const name of LANDMARK_NAMES) {
        scene.add(landmarks[name].obj);
      }
      scene.add(faceOrigin.obj);
      // scene.add(modelBaseOrigin.obj);
    }

    // These interpolation functions store cached values. They should be defined
    // only once, outside the `animate` function.
    const jawAngleInterpolation = smoothed((jawOpen: number) => {
      const [correction, min, max] = [-0.01, 0.005, 0.3];
      const maxJawAngle = -deg(30);
      const jawOpenRatio = easeOutCubic(clamp(jawOpen, correction, min, max));
      return jawOpenRatio * maxJawAngle;
    });
    const eyeBlinkInterpolation = throttledBlink((eyeBlink: number) => {
      return eyeBlink > BLINK_THRESHOLD;
    });
    const rollInterpolation = smoothed((rollAngle: number) => {
      const [correction, min, max] = [0, -deg(95), deg(95)];
      const rollRatio = easeInOutQuad(clamp(rollAngle, correction, min, max));
      return min + rollRatio * (max - min);
    });
    const pitchInterpolation = smoothed((pitchAngle: number) => {
      const [correction, min, max] = [0, -deg(95), deg(95)];
      const pitchRatio = easeInOutQuad(clamp(pitchAngle, correction, min, max));
      return min + pitchRatio * (max - min);
    });
    const yawInterpolation = smoothed((yawAngle: number) => {
      const [correction, min, max] = [-deg(10), -deg(95), deg(95)];
      const yawRatio = easeInOutQuad(clamp(yawAngle, correction, min, max));
      return min + yawRatio * (max - min);
    });

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();

      const result = this.detectFace();

      if (!result) {
        renderer.render(scene, camera);
        return;
      }

      for (const name of LANDMARK_NAMES) {
        // Map face coords to world coords
        landmarks[name].position.x = -(-0.5 + result.landmarks[name].x) * SCALE;
        landmarks[name].position.y = (0.5 - result.landmarks[name].y) * SCALE;
        landmarks[name].position.z = result.landmarks[name].z * SCALE;
      }

      const { eyeBlinkLeft, eyeBlinkRight, jawOpen } = result.blendshapes;

      if (eyeBlinkLeft > BLINK_THRESHOLD || eyeBlinkRight > BLINK_THRESHOLD) {
        landmarks.eyeLeft.color = this.colors.active;
        landmarks.eyeRight.color = this.colors.active;
      } else {
        landmarks.eyeLeft.color = this.colors.base;
        landmarks.eyeRight.color = this.colors.base;
      }

      // Determine head positioning
      {
        const midpoint = landmarks.faceLeft.position
          .clone()
          .add(landmarks.faceRight.position)
          .divideScalar(2);

        const horizAxis = landmarks.faceRight.position.clone().sub(landmarks.faceLeft.position);
        const vertAxis = landmarks.faceTop.position.clone().sub(landmarks.faceBottom.position);
        const normal = horizAxis.clone().cross(vertAxis).normalize();

        const faceWidth = landmarks.faceLeft.position.distanceTo(landmarks.faceRight.position);
        const offset = normal.multiplyScalar(faceWidth * 0.25);
        const origin = midpoint.clone().sub(offset);

        faceOrigin.position.set(origin.x, origin.y, origin.z);
        faceUpward = vertAxis.normalize();
        faceForward = normal;
      }

      if (modelBones && initialBoneSettings && eyeLMesh && eyeRMesh) {
        // Determine the model's base bone position
        const baseOrigin = new THREE.Vector3();
        modelBones.body[0].getWorldPosition(baseOrigin);
        modelBaseOrigin.position.set(baseOrigin.x, baseOrigin.y, baseOrigin.z);

        // Jaw animation
        const jawAngle = jawAngleInterpolation(jawOpen);
        const jawBone = modelBones.jaw;
        jawBone.rotation.z = initialBoneSettings[jawBone.name].rotation.z + jawAngle;

        // Eye blinks
        const eyeSize = eyeBlinkInterpolation(Math.max(eyeBlinkLeft, eyeBlinkRight));
        eyeLMesh.morphTargetInfluences = [eyeSize];
        eyeRMesh.morphTargetInfluences = [eyeSize];

        // Roll
        const rawRollAngle = new THREE.Vector2(faceUpward.x, faceUpward.y).angle() - Math.PI / 2;
        const rollAngle = rollInterpolation(rawRollAngle);
        const neckBone = modelBones.body[3];
        neckBone.rotation.x = initialBoneSettings[neckBone.name].rotation.x + rollAngle;

        // Pitch
        const rawPitchAngle = new THREE.Vector2(faceForward.z, -faceForward.y).angle() - Math.PI;
        const pitchAngle = pitchInterpolation(rawPitchAngle);
        neckBone.rotation.z = initialBoneSettings[neckBone.name].rotation.z + pitchAngle;

        // Yaw
        const rawYawAngle = new THREE.Vector2(faceForward.z, -faceForward.x).angle() - Math.PI;
        const yawAngle = yawInterpolation(rawYawAngle);
        neckBone.rotation.y = initialBoneSettings[neckBone.name].rotation.y + yawAngle;
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

  loadModel(
    onLoad: (
      model: THREE.Group<THREE.Object3DEventMap>,
      bones: ModelBones,
      initialBoneSettings: BoneSettings,
    ) => void,
  ) {
    const loader = new GLTFLoader();
    loader.load(
      '/janktuber_v1.glb',
      (gltf) => {
        const model = gltf.scene;

        model.scale.set(SCALE, SCALE, SCALE);
        model.position.set(4, -0.7 * SCALE, 0);
        model.rotateY(deg(-80));
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (obj.name == 'EyeL' || obj.name == 'EyeR') {
              obj.material = new THREE.MeshToonMaterial({
                color: this.colors.accent,
                wireframe: true,
              });
            } else {
              obj.material = new THREE.MeshPhongMaterial({
                color: this.colors.base,
                wireframe: false,
              });
            }
          }
        });

        const mesh = model.getObjectByName('Character') as THREE.SkinnedMesh;
        const bones = mesh.skeleton.bones;
        const modelBones: ModelBones = {
          tail: bones
            .filter((bone) =>
              ['Bone001', 'Bone002', 'Bone003', 'Bone005', 'Bone006'].includes(bone.name),
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
          body: bones
            .filter((bone) =>
              ['Bone', 'Bone007', 'Bone008', 'Bone009', 'Bone010'].includes(bone.name),
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
          jaw: bones.find((bone) => bone.name == 'Bone012')!,
          muzzle: bones.find((bone) => bone.name == 'Bone011')!,
          earL: bones.find((bone) => bone.name == 'Bone013')!,
          earR: bones.find((bone) => bone.name == 'Bone014')!,
          eyeL: bones.find((bone) => bone.name == 'Bone004')!,
          eyeR: bones.find((bone) => bone.name == 'Bone015')!,
        };
        const boneSettings = bones.reduce((settings, bone) => {
          settings[bone.name] = {
            position: bone.position.clone(),
            rotation: bone.rotation.clone(),
          };
          return settings;
        }, {} as BoneSettings);

        onLoad(model, modelBones, boneSettings);
      },
      undefined,
      (error) => {
        console.error(error);
      },
    );
  }
}

class Landmark {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  obj: THREE.Mesh;

  constructor(color: THREE.Color, radius = 0.2, segments = 5) {
    this.geometry = new THREE.CircleGeometry(radius, segments);
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
