import { useEffect, useState } from 'preact/hooks';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const DETECTION_RATE = 1.0 / 20;

// https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png
const LANDMARK_INDICES = {
  faceTop: 10,
  faceLeft: 127,
  faceBottom: 152,
  faceRight: 356,
  eyeLeft: 468,
  eyeRight: 473,
  nose: 4,
  lipUpper: 11,
  lipLower: 16,
} as const;

const LANDMARK_NAMES = Object.keys(LANDMARK_INDICES) as Array<keyof typeof LANDMARK_INDICES>;

const BLENDSHAPE_INDICES = {
  browOuterUpLeft: 4,
  browOuterUpRight: 5,
  eyeBlinkLeft: 9,
  eyeBlinkRight: 10,
  jawOpen: 25,
  mouthSmileLeft: 44,
  mouthSmileRight: 45,
} as const;

const BLENDSHAPE_NAMES = Object.keys(BLENDSHAPE_INDICES) as Array<keyof typeof BLENDSHAPE_INDICES>;

export type Position = { x: number; y: number; z: number };

export type LandmarkData = Record<keyof typeof LANDMARK_INDICES, Position>;

export type BlendshapeData = Record<keyof typeof BLENDSHAPE_INDICES, number>;

export type DetectFaceCallback = () => {
  readonly landmarks: LandmarkData;
  readonly blendshapes: BlendshapeData;
} | null;

export function useFaceDetection(videoEl: HTMLVideoElement | null) {
  const [facemarker, setFacemarker] = useState<FaceLandmarker | null>(null);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [detectFace, setDetectFace] = useState<DetectFaceCallback | null>(null);

  useEffect(() => {
    // https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js#setup
    // https://codepen.io/mediapipe-preview/pen/OJBVQJm
    FilesetResolver.forVisionTasks('/face-detection/wasm')
      .then((vision) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/face-detection/face_landmarker.task',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        }),
      )
      .then(setFacemarker);
  }, []);

  useEffect(() => {
    if (!videoEl) return;

    navigator.mediaDevices.getUserMedia({ video: true }).then((mediaStream) => {
      videoEl.srcObject = mediaStream;
      setTimeout(() => {
        setVideoInitialized(true);
      }, 0);
    });
  }, [videoEl]);

  useEffect(() => {
    if (!videoEl || !videoInitialized || videoReady) return;

    const interval = setInterval(() => {
      setVideoReady(videoEl.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA);
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [videoInitialized, videoReady]);

  useEffect(() => {
    if (!facemarker || !videoEl || !videoReady) return;

    let lastVideoTime = -1;

    const detectFaceCallback: DetectFaceCallback = () => {
      if (videoEl.currentTime - lastVideoTime < DETECTION_RATE) return null;

      const { faceLandmarks, faceBlendshapes } = facemarker.detectForVideo(
        videoEl,
        performance.now(),
      );

      lastVideoTime = videoEl.currentTime;

      if (!faceLandmarks[0] || !faceBlendshapes[0]) return null;

      const landmarks = {} as LandmarkData;
      for (const landmarkName of LANDMARK_NAMES) {
        landmarks[landmarkName] = faceLandmarks[0][LANDMARK_INDICES[landmarkName]];
      }

      const blendshapes = {} as BlendshapeData;
      for (const blendshapeName of BLENDSHAPE_NAMES) {
        const { score } = faceBlendshapes[0].categories[BLENDSHAPE_INDICES[blendshapeName]];
        blendshapes[blendshapeName] = score;
      }

      return { landmarks, blendshapes } as const;
    };

    setDetectFace(() => detectFaceCallback);
  }, [facemarker, videoEl, videoReady]);

  return detectFace;
}
