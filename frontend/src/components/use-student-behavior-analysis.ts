import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface StudentBehaviorState {
  isSquinting: boolean;       // Vision strain, needing glasses, or deep concentration
  isConfused: boolean;        // Furrowed brows, frustration
  isDistracted: boolean;      // Looking away from the screen frequently
  isFatigued: boolean;        // Eyes closed for longer periods
  isReadingAloud: boolean;    // Mouthing words, often seen in dyslexia or early reading
}

export function useStudentBehaviorAnalysis(videoElement: HTMLVideoElement | null, isActive: boolean, isMuted: boolean = false) {
  const [behaviorState, setBehaviorState] = useState<StudentBehaviorState>({
    isSquinting: false,
    isConfused: false,
    isDistracted: false,
    isFatigued: false,
    isReadingAloud: false,
  });

  const [modelReady, setModelReady] = useState(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function initModel() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (active) {
          faceLandmarkerRef.current = faceLandmarker;
          setModelReady(true);
        }
      } catch (error) {
        console.error("Failed to load FaceLandmarker:", error);
      }
    }

    initModel();

    return () => {
      active = false;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive || !modelReady || !videoElement) return;

    let lastVideoTime = -1;

    // State accumulators to prevent flickering
    let distractionFrames = 0;
    let fatigueFrames = 0;
    let readingAloudFrames = 0;

    const predict = () => {
      if (videoElement.readyState >= 2 && faceLandmarkerRef.current) {
        const startTimeMs = performance.now();
        if (lastVideoTime !== videoElement.currentTime) {
          lastVideoTime = videoElement.currentTime;
          const results = faceLandmarkerRef.current.detectForVideo(videoElement, startTimeMs);

          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const blendshapes = results.faceBlendshapes[0].categories;

            // Helper to get score safely
            const getScore = (name: string) => blendshapes.find(b => b.categoryName === name)?.score || 0;

            // 1. Squinting (Vision Strain)
            const eyeSquintLeft = getScore("eyeSquintLeft");
            const eyeSquintRight = getScore("eyeSquintRight");
            const isSquinting = (eyeSquintLeft > 0.4 && eyeSquintRight > 0.4);

            // 2. Confusion / Frustration (Furrowed Brows)
            const browDownLeft = getScore("browDownLeft");
            const browDownRight = getScore("browDownRight");
            const isConfused = (browDownLeft > 0.5 && browDownRight > 0.5);

            // 3. Distraction (Looking away from center)
            const lookOutLeft = getScore("eyeLookOutLeft");
            const lookInLeft = getScore("eyeLookInLeft");
            const lookOutRight = getScore("eyeLookOutRight");
            const lookInRight = getScore("eyeLookInRight");
            const lookUp = (getScore("eyeLookUpLeft") + getScore("eyeLookUpRight")) / 2;
            const lookDown = (getScore("eyeLookDownLeft") + getScore("eyeLookDownRight")) / 2;

            // If eyes are looking far away from the center
            const isLookingAway = lookOutLeft > 0.6 || lookInLeft > 0.6 ||
              lookOutRight > 0.6 || lookInRight > 0.6 ||
              lookUp > 0.6 || lookDown > 0.6;

            if (isLookingAway) distractionFrames++;
            else distractionFrames = Math.max(0, distractionFrames - 1);
            const isDistracted = distractionFrames > 15; // Sustained distraction

            // 4. Fatigue (Eyes closed)
            const eyeBlinkLeft = getScore("eyeBlinkLeft");
            const eyeBlinkRight = getScore("eyeBlinkRight");
            const isEyesClosed = (eyeBlinkLeft > 0.7 && eyeBlinkRight > 0.7);

            if (isEyesClosed) fatigueFrames++;
            else fatigueFrames = Math.max(0, fatigueFrames - 1);
            const isFatigued = fatigueFrames > 10; // Sustained closed eyes = drowsy, not just a blink

            // 5. Reading Aloud / Mouthing words
            const jawOpen = getScore("jawOpen");
            const mouthFunnel = getScore("mouthFunnel");
            const mouthPucker = getScore("mouthPucker");
            const isMouthMoving = (jawOpen > 0.15 || mouthFunnel > 0.2 || mouthPucker > 0.2);

            if (isMouthMoving) readingAloudFrames++;
            else readingAloudFrames = Math.max(0, readingAloudFrames - 1);
            const isReadingAloud = readingAloudFrames > 10;

            setBehaviorState(prev => {
              if (
                prev.isSquinting === isSquinting &&
                prev.isConfused === isConfused &&
                prev.isDistracted === isDistracted &&
                prev.isFatigued === isFatigued &&
                prev.isReadingAloud === isReadingAloud
              ) {
                return prev;
              }
              return {
                isSquinting,
                isConfused,
                isDistracted,
                isFatigued,
                isReadingAloud
              };
            });
          }
        }
      }
      requestRef.current = requestAnimationFrame(predict);
    };

    requestRef.current = requestAnimationFrame(predict);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, modelReady, videoElement]);

  return { behaviorState, modelReady };
}
