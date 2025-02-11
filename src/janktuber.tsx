import { useEffect, useState } from 'preact/hooks';
import * as THREE from 'three';

import { useFaceDetection, LandmarkData, BlendshapeData } from './use-face-detection';

export function Janktuber() {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const detectFace = useFaceDetection(videoEl);
  const [landmarks, setLandmarks] = useState<LandmarkData | null>(null);
  const [blendshapes, setBlendshapes] = useState<BlendshapeData | null>(null);

  useEffect(() => {
    if (!detectFace || !containerEl) return;

    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    camera.position.z = 10;

    // const ambientLight = new THREE.HemisphereLight(this.colors.sky, this.colors.ground, 3);
    // scene.add(ambientLight);

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();

      const result = detectFace();
      if (result) {
        setLandmarks(result.landmarks);
        setBlendshapes(result.blendshapes);
      }

      renderer.render(scene, camera);
    };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x0, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    containerEl.appendChild(renderer.domElement);
  }, [detectFace, containerEl]);

  return (
    <div className="Janktuber">
      <video ref={setVideoEl} autoplay style={{ display: 'none' }} />

      <div ref={setContainerEl} className="container" />

      <pre>
        <code>{JSON.stringify(landmarks, null, 2)}</code>
      </pre>

      <pre>
        <code>{JSON.stringify(blendshapes, null, 2)}</code>
      </pre>
    </div>
  );
}
