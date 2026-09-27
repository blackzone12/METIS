"use client";

import { useEffect, useRef, useState } from "react";

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

export interface StudentBehaviorState {
  isSquinting: boolean;
  isConfused: boolean;
  isDistracted: boolean;
  isFatigued: boolean;
  isReadingAloud: boolean;
}

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECTION_INTERVAL_MS = 100;

const EMPTY_BEHAVIOR_STATE: StudentBehaviorState = {
  isSquinting: false,
  isConfused: false,
  isDistracted: false,
  isFatigued: false,
  isReadingAloud: false,
};

export function useStudentBehaviorAnalysis(
  videoElement: HTMLVideoElement | null,
  isActive: boolean,
  isMuted: boolean = false,
) {
  const [behaviorState, setBehaviorState] =
    useState<StudentBehaviorState>(
      EMPTY_BEHAVIOR_STATE,
    );

  const [modelReady, setModelReady] =
    useState(false);

  const faceLandmarkerRef =
    useRef<FaceLandmarker | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const lastDetectionTimeRef =
    useRef(0);

  const distractionTimeRef =
    useRef(0);

  const fatigueTimeRef =
    useRef(0);

  const mouthMovementTimeRef =
    useRef(0);

  /*
   * ------------------------------------------------------------
   * RESET
   * ------------------------------------------------------------
   */

  const resetDetectionState = () => {
    distractionTimeRef.current = 0;
    fatigueTimeRef.current = 0;
    mouthMovementTimeRef.current = 0;

    setBehaviorState(
      EMPTY_BEHAVIOR_STATE,
    );
  };

  /*
   * ------------------------------------------------------------
   * INITIALIZE MEDIAPIPE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    let createdLandmarker:
      | FaceLandmarker
      | null = null;

    async function initModel() {
      try {
        const filesetResolver =
          await FilesetResolver.forVisionTasks(
            WASM_URL,
          );

        createdLandmarker =
          await FaceLandmarker.createFromOptions(
            filesetResolver,
            {
              baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: "GPU",
              },

              outputFaceBlendshapes: true,

              runningMode: "VIDEO",

              numFaces: 1,
            },
          );

        if (cancelled) {
          createdLandmarker.close();
          createdLandmarker = null;
          return;
        }

        faceLandmarkerRef.current =
          createdLandmarker;

        setModelReady(true);
      } catch (error) {
        console.error(
          "Failed to initialize MediaPipe FaceLandmarker:",
          error,
        );

        setModelReady(false);
      }
    }

    void initModel();

    return () => {
      cancelled = true;

      if (
        animationFrameRef.current !== null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );

        animationFrameRef.current = null;
      }

      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }

      if (createdLandmarker) {
        try {
          createdLandmarker.close();
        } catch {
          // Already closed.
        }

        createdLandmarker = null;
      }

      setModelReady(false);
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * DETECTION
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !isActive ||
      !modelReady ||
      !videoElement
    ) {
      resetDetectionState();
      return;
    }

    let cancelled = false;

    let previousTime =
      performance.now();

    const getScore = (
      results: FaceLandmarkerResult,
      name: string,
    ): number => {
      const categories =
        results.faceBlendshapes?.[0]
          ?.categories;

      if (!categories) {
        return 0;
      }

      return (
        categories.find(
          (category) =>
            category.categoryName === name,
        )?.score ?? 0
      );
    };

    const processResults = (
      results: FaceLandmarkerResult,
      elapsedMs: number,
    ) => {
      /*
       * --------------------------------------------------------
       * NO FACE
       * --------------------------------------------------------
       */

      if (
        !results.faceBlendshapes ||
        results.faceBlendshapes.length === 0
      ) {
        distractionTimeRef.current =
          Math.max(
            0,
            distractionTimeRef.current -
              elapsedMs,
          );

        fatigueTimeRef.current =
          Math.max(
            0,
            fatigueTimeRef.current -
              elapsedMs,
          );

        mouthMovementTimeRef.current =
          Math.max(
            0,
            mouthMovementTimeRef.current -
              elapsedMs,
          );

        setBehaviorState(
          (previous) => ({
            ...previous,

            isSquinting: false,

            isConfused: false,

            isReadingAloud: false,

            isDistracted:
              distractionTimeRef.current >=
              2000,

            isFatigued:
              fatigueTimeRef.current >=
              1500,
          }),
        );

        return;
      }

      /*
       * --------------------------------------------------------
       * 1. SQUINTING
       * --------------------------------------------------------
       */

      const eyeSquintLeft =
        getScore(
          results,
          "eyeSquintLeft",
        );

      const eyeSquintRight =
        getScore(
          results,
          "eyeSquintRight",
        );

      const isSquinting =
        eyeSquintLeft > 0.4 &&
        eyeSquintRight > 0.4;

      /*
       * --------------------------------------------------------
       * 2. CONFUSION / BROW MOVEMENT
       * --------------------------------------------------------
       */

      const browDownLeft =
        getScore(
          results,
          "browDownLeft",
        );

      const browDownRight =
        getScore(
          results,
          "browDownRight",
        );

      const isConfused =
        browDownLeft > 0.5 &&
        browDownRight > 0.5;

      /*
       * --------------------------------------------------------
       * 3. LOOKING AWAY / DISTRACTION
       * --------------------------------------------------------
       */

      const lookOutLeft =
        getScore(
          results,
          "eyeLookOutLeft",
        );

      const lookInLeft =
        getScore(
          results,
          "eyeLookInLeft",
        );

      const lookOutRight =
        getScore(
          results,
          "eyeLookOutRight",
        );

      const lookInRight =
        getScore(
          results,
          "eyeLookInRight",
        );

      const lookUp =
        (
          getScore(
            results,
            "eyeLookUpLeft",
          ) +
          getScore(
            results,
            "eyeLookUpRight",
          )
        ) / 2;

      const lookDown =
        (
          getScore(
            results,
            "eyeLookDownLeft",
          ) +
          getScore(
            results,
            "eyeLookDownRight",
          )
        ) / 2;

      const isLookingAway =
        lookOutLeft > 0.6 ||
        lookInLeft > 0.6 ||
        lookOutRight > 0.6 ||
        lookInRight > 0.6 ||
        lookUp > 0.6 ||
        lookDown > 0.6;

      if (isLookingAway) {
        distractionTimeRef.current +=
          elapsedMs;
      } else {
        distractionTimeRef.current =
          Math.max(
            0,
            distractionTimeRef.current -
              elapsedMs * 1.5,
          );
      }

      const isDistracted =
        distractionTimeRef.current >=
        2000;

      /*
       * --------------------------------------------------------
       * 4. FATIGUE
       * --------------------------------------------------------
       */

      const eyeBlinkLeft =
        getScore(
          results,
          "eyeBlinkLeft",
        );

      const eyeBlinkRight =
        getScore(
          results,
          "eyeBlinkRight",
        );

      const isEyesClosed =
        eyeBlinkLeft > 0.7 &&
        eyeBlinkRight > 0.7;

      if (isEyesClosed) {
        fatigueTimeRef.current +=
          elapsedMs;
      } else {
        fatigueTimeRef.current =
          Math.max(
            0,
            fatigueTimeRef.current -
              elapsedMs * 2,
          );
      }

      const isFatigued =
        fatigueTimeRef.current >=
        1500;

      /*
       * --------------------------------------------------------
       * 5. MOUTH MOVEMENT
       * --------------------------------------------------------
       */

      const jawOpen =
        getScore(
          results,
          "jawOpen",
        );

      const mouthFunnel =
        getScore(
          results,
          "mouthFunnel",
        );

      const mouthPucker =
        getScore(
          results,
          "mouthPucker",
        );

      const isMouthMoving =
        jawOpen > 0.15 ||
        mouthFunnel > 0.2 ||
        mouthPucker > 0.2;

      if (
        !isMuted &&
        isMouthMoving
      ) {
        mouthMovementTimeRef.current +=
          elapsedMs;
      } else {
        mouthMovementTimeRef.current =
          Math.max(
            0,
            mouthMovementTimeRef.current -
              elapsedMs * 1.5,
          );
      }

      const isReadingAloud =
        !isMuted &&
        mouthMovementTimeRef.current >=
          1000;

      /*
       * --------------------------------------------------------
       * UPDATE STATE
       * --------------------------------------------------------
       */

      setBehaviorState(
        (previous) => {
          if (
            previous.isSquinting ===
              isSquinting &&
            previous.isConfused ===
              isConfused &&
            previous.isDistracted ===
              isDistracted &&
            previous.isFatigued ===
              isFatigued &&
            previous.isReadingAloud ===
              isReadingAloud
          ) {
            return previous;
          }

          return {
            isSquinting,
            isConfused,
            isDistracted,
            isFatigued,
            isReadingAloud,
          };
        },
      );
    };

    /*
     * --------------------------------------------------------
     * ANIMATION LOOP
     * --------------------------------------------------------
     */

    const detect = () => {
      if (cancelled) {
        return;
      }

      const now =
        performance.now();

      const elapsedMs =
        Math.min(
          now - previousTime,
          500,
        );

      previousTime = now;

      if (
        now -
          lastDetectionTimeRef.current >=
        DETECTION_INTERVAL_MS
      ) {
        lastDetectionTimeRef.current =
          now;

        if (
          videoElement.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA &&
          videoElement.videoWidth > 0 &&
          videoElement.videoHeight > 0 &&
          faceLandmarkerRef.current
        ) {
          try {
            const results =
              faceLandmarkerRef.current.detectForVideo(
                videoElement,
                now,
              );

            processResults(
              results,
              elapsedMs,
            );
          } catch (error) {
            console.error(
              "Face detection failed:",
              error,
            );
          }
        }
      }

      animationFrameRef.current =
        requestAnimationFrame(detect);
    };

    animationFrameRef.current =
      requestAnimationFrame(detect);

    return () => {
      cancelled = true;

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current,
        );

        animationFrameRef.current =
          null;
      }

      lastDetectionTimeRef.current = 0;

      resetDetectionState();
    };
  }, [
    videoElement,
    isActive,
    modelReady,
    isMuted,
  ]);

  return {
    behaviorState,
    modelReady,
  };
}
