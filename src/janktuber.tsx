import { useEffect, useState } from 'preact/hooks';

import { useFaceDetection, LandmarkData, BlendshapeData } from './use-face-detection';

export function Janktuber() {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const detectFace = useFaceDetection(videoEl);
  const [landmarks, setLandmarks] = useState<LandmarkData | null>(null);
  const [blendshapes, setBlendshapes] = useState<BlendshapeData | null>(null);

  useEffect(() => {
    if (!detectFace || !containerEl) return;

    let stopped = false;

    const renderLoop = () => {
      if (stopped) return;

      const result = detectFace();
      if (result) {
        setLandmarks(result.landmarks);
        setBlendshapes(result.blendshapes);
      }

      requestAnimationFrame(() => {
        renderLoop();
      });
    };

    renderLoop();

    return () => {
      stopped = true;
    };
  }, [detectFace, containerEl]);

  return (
    <div className="Janktuber">
      <video ref={setVideoEl} autoplay />

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
