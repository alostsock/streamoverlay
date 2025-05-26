import { useEffect, useState } from 'preact/hooks';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  EffectComposer,
  RenderPixelatedPass,
  RenderPass,
  OutputPass,
} from 'three/examples/jsm/Addons.js';

import {
  useFaceDetection,
  LandmarkData,
  BlendshapeData,
  LANDMARK_NAMES,
  BLENDSHAPE_NAMES,
  FaceResults,
  DetectFaceCallback,
} from './use-face-detection';
import { DEBUG, COLORS, POSTPROCESSING_MODE, PIXEL_SIZE, deg } from './three-utils';
import {
  clamp,
  smoothed,
  averagePointEstimator,
  blinkAnimation,
  deadPoseAnimation,
  easeInOutQuad,
  easeOutCirc,
  tailAnimation,
} from './interpolation-utils';

const RENDER_RATE = 1.0 / 30;
const SCALE = 12;
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
    camera.rotateX(deg(-5));

    const ambientLight = new THREE.HemisphereLight(COLORS.sky, COLORS.ground, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(COLORS.sky, 250.0);
    pointLight.position.set(10, 7, 4);
    scene.add(pointLight);

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
      faceTop: new Landmark(COLORS.base),
      faceLeft: new Landmark(COLORS.base),
      faceBottom: new Landmark(COLORS.base),
      faceRight: new Landmark(COLORS.base),
      eyeLeft: new Landmark(COLORS.base),
      eyeRight: new Landmark(COLORS.base),
      nose: new Landmark(COLORS.base),
      lipUpper: new Landmark(COLORS.base),
      lipLower: new Landmark(COLORS.base),
    };

    const faceOrigin = new Landmark(COLORS.accent, 0.3, 4);
    const averageFaceOrigin = new Landmark(COLORS.ground, 0.2, 4);
    let faceUpward = new THREE.Vector3();
    let faceForward = new THREE.Vector3();

    const modelBaseOrigin = new Landmark(COLORS.accent, 1.5, 4);

    if (DEBUG) {
      for (const name of LANDMARK_NAMES) {
        scene.add(landmarks[name].obj);
      }
      scene.add(faceOrigin.obj);
      scene.add(averageFaceOrigin.obj);
      // scene.add(modelBaseOrigin.obj);
    }

    // These functions store cached values. They should be defined only once,
    // outside the `animate` function.
    const estimateAverageFaceOrigin = averagePointEstimator();
    const smoothTimeMs = 200;
    const smoothFrames = Math.floor(smoothTimeMs / 1000 / RENDER_RATE);
    const blinkAnimator = blinkAnimation(BLINK_THRESHOLD);
    const jawAngleInterp = smoothed(Math.max(smoothFrames / 2, 1));
    const xInterp = smoothed(smoothFrames);
    const yInterp = smoothed(smoothFrames);
    const zInterp = smoothed(smoothFrames);
    const rollInterp = smoothed(smoothFrames);
    const yawInterp = smoothed(smoothFrames);
    const pitchInterp = smoothed(smoothFrames);
    const deadPoseAnimator = deadPoseAnimation(
      0.9,
      -deg(25),
      new THREE.Vector3(-0.7, -2, -0.5),
      new THREE.Vector3(1, -0.95, -0.3),
    );
    const tailAnimator = tailAnimation();

    let prevFaceResult: FaceResults | null = null;

    const clock = new THREE.Clock();
    let delta = 0;

    const animate = () => {
      delta += clock.getDelta();
      if (delta <= RENDER_RATE) {
        return;
      }
      delta = delta % RENDER_RATE;

      let faceResult = this.detectFace();

      let isAlive = false;
      if (!faceResult) {
        isAlive = false;
        faceResult = prevFaceResult;
      } else {
        isAlive = true;
        prevFaceResult = faceResult;
      }

      if (!faceResult) {
        renderer.render(scene, camera);
        return;
      }

      for (const name of LANDMARK_NAMES) {
        // Map face coords to world coords
        landmarks[name].position.x = -(-0.5 + faceResult.landmarks[name].x) * SCALE;
        landmarks[name].position.y = (0.5 - faceResult.landmarks[name].y) * SCALE;
        landmarks[name].position.z = faceResult.landmarks[name].z * SCALE;
      }

      const { eyeBlinkLeft, eyeBlinkRight, jawOpen } = faceResult.blendshapes;

      if (eyeBlinkLeft > BLINK_THRESHOLD || eyeBlinkRight > BLINK_THRESHOLD) {
        landmarks.eyeLeft.color = COLORS.active;
        landmarks.eyeRight.color = COLORS.active;
      } else {
        landmarks.eyeLeft.color = COLORS.base;
        landmarks.eyeRight.color = COLORS.base;
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

        const averageOrigin = estimateAverageFaceOrigin(origin);
        averageFaceOrigin.position.set(averageOrigin.x, averageOrigin.y, averageOrigin.z);

        faceUpward = vertAxis.normalize();
        faceForward = normal;
      }

      if (modelBones && initialBoneSettings && eyeLMesh && eyeRMesh) {
        // Determine the model's base bone position
        const baseOrigin = new THREE.Vector3();
        modelBones.body[0].getWorldPosition(baseOrigin);
        modelBaseOrigin.position.set(baseOrigin.x, baseOrigin.y, baseOrigin.z);

        const eyeBlink = Math.max(eyeBlinkLeft, eyeBlinkRight);
        const eyeMorph = blinkAnimator(eyeBlink);

        const maxJawAngle = -deg(30);
        const jawOpenRatio = easeOutCirc(clamp(jawOpen, -0.01, 0.005, 0.3));
        const jawAngle = jawOpenRatio * maxJawAngle;

        // Displacement

        const modelDisplacement = new THREE.Vector3();

        const [xCorrection, xMin, xMax] = [0, -2, 2];
        const xRaw = faceOrigin.position.x - averageFaceOrigin.position.x;
        const xRatio = easeInOutQuad(clamp(xRaw, xCorrection, xMin, xMax));
        modelDisplacement.x = xMin + xRatio * (xMax - xMin);

        const [yCorrection, yMin, yMax] = [0, -2.5, 1.5];
        const yRaw = faceOrigin.position.y - averageFaceOrigin.position.y;
        const yRatio = easeInOutQuad(clamp(yRaw, yCorrection, yMin, yMax));
        modelDisplacement.y = yMin + yRatio * (yMax - yMin);

        const [zCorrection, zMin, zMax] = [0, 0.5, 2];
        const zRaw = faceOrigin.position.z - averageFaceOrigin.position.z;
        const zRatio = easeInOutQuad(clamp(zRaw, zCorrection, zMin, zMax));
        modelDisplacement.z = zMin + zRatio * (zMax - zMin);

        // Rotation

        const modelRotation = new THREE.Vector3();
        const [minAngle, maxAngle] = [-deg(95), deg(95)];

        const rawRollAngle = new THREE.Vector2(faceUpward.x, faceUpward.y).angle() - Math.PI / 2;
        const rollRatio = easeInOutQuad(clamp(rawRollAngle, 0, minAngle, maxAngle));
        modelRotation.x = minAngle + rollRatio * (maxAngle - minAngle);

        const rawYawAngle = new THREE.Vector2(faceForward.z, -faceForward.x).angle() - Math.PI;
        const yawRatio = easeInOutQuad(clamp(rawYawAngle, -deg(5), minAngle, maxAngle));
        modelRotation.y = minAngle + yawRatio * (maxAngle - minAngle);

        const rawPitchAngle = new THREE.Vector2(faceForward.z, -faceForward.y).angle() - Math.PI;
        const pitchRatio = easeInOutQuad(clamp(rawPitchAngle, deg(5), minAngle, maxAngle));
        modelRotation.z = minAngle + pitchRatio * (maxAngle - minAngle);

        const applyInterpolations = (
          eyeMorph: number,
          jawAngle: number,
          d: THREE.Vector3,
          r: THREE.Vector3,
        ) => {
          eyeLMesh!.morphTargetInfluences = [eyeMorph];
          eyeRMesh!.morphTargetInfluences = [eyeMorph];

          const jawBone = modelBones!.jaw;
          jawBone.rotation.z =
            initialBoneSettings![jawBone.name].rotation.z + jawAngleInterp(jawAngle);

          const distanceWeights = [0.1, 0.35, 0.35, 0.2, 0.0];
          const dX = xInterp(d.x);
          modelBones!.body.forEach((bone, index) => {
            bone.position.x =
              initialBoneSettings![bone.name].position.x + (distanceWeights[index] * dX) / SCALE;
          });
          const dY = yInterp(d.y);
          modelBones!.body.forEach((bone, index) => {
            bone.position.y =
              initialBoneSettings![bone.name].position.y + (distanceWeights[index] * dY) / SCALE;
          });
          const dZ = zInterp(d.z);
          modelBones!.body.forEach((bone, index) => {
            bone.position.z =
              initialBoneSettings![bone.name].position.z + (distanceWeights[index] * dZ) / SCALE;
          });

          const rollWeights = [0.1, 0.2, 0.1, 0.3, 0.3];
          const rX = rollInterp(r.x);
          modelBones!.body.forEach((bone, index) => {
            bone.rotation.x = initialBoneSettings![bone.name].rotation.x + rollWeights[index] * rX;
          });
          const yawWeights = [0.1, 0.1, 0.2, 0.3, 0.3];
          const rY = yawInterp(r.y);
          modelBones!.body.forEach((bone, index) => {
            bone.rotation.y = initialBoneSettings![bone.name].rotation.y + yawWeights[index] * rY;
          });
          const pitchWeights = [0.1, 0.1, 0.2, 0.3, 0.3];
          const rZ = pitchInterp(r.z);
          modelBones!.body.forEach((bone, index) => {
            bone.rotation.z = initialBoneSettings![bone.name].rotation.z + pitchWeights[index] * rZ;
          });

          const tailAngle = deg(50) * tailAnimator();
          const tailWeights = [0.05, 0.1, 0.25, 0.3, 0.3];
          modelBones!.tail.forEach((bone, index) => {
            bone.rotation.z =
              initialBoneSettings![bone.name].rotation.z + tailWeights[index] * tailAngle;
          });
        };

        const deadPose = deadPoseAnimator(
          isAlive,
          eyeMorph,
          jawAngle,
          modelDisplacement,
          modelRotation,
        );

        if (deadPose) {
          applyInterpolations(
            deadPose.eyeMorph,
            deadPose.jawAngle,
            deadPose.displacement,
            deadPose.rotation,
          );
        } else {
          applyInterpolations(eyeMorph, jawAngle, modelDisplacement, modelRotation);
        }
      }

      composer.render();
    };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x0, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);

    const composer = new EffectComposer(renderer);
    if (POSTPROCESSING_MODE === 'pixel') {
      composer.addPass(new RenderPixelatedPass(PIXEL_SIZE, scene, camera));
    } else {
      composer.addPass(new RenderPass(scene, camera));
    }
    composer.addPass(new OutputPass());

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
        model.position.set(DEBUG ? 4 : 0, -0.7 * SCALE, 0);
        model.rotateY(DEBUG ? deg(-80) : deg(-50));
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (obj.name == 'EyeL' || obj.name == 'EyeR') {
              obj.material = new THREE.MeshToonMaterial({
                color: COLORS.accent,
                wireframe: true,
              });
            } else {
              obj.material = new THREE.MeshToonMaterial({
                color: COLORS.base,
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
