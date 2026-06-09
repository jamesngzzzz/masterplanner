"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useScreenRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = "Video đang được ghi hình. Nếu bạn đóng trang, toàn bộ video sẽ bị mất!";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecording]);

  const stopRecording = useCallback(async (uploadUrl?: string) => {
    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        resolve();
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        const stream = streamRef.current;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        if (uploadUrl && recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const formData = new FormData();
          formData.append("file", blob, "recording.webm");

          try {
            await fetch(uploadUrl, {
              method: "POST",
              body: formData,
            });
            console.log("Recording uploaded successfully.");
          } catch (err) {
            console.error("Error uploading recording:", err);
          }
        }
        resolve();
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const startRecording = useCallback(async (uploadUrl?: string) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false // Ask for audio if needed, but video is usually enough
      });
      
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      // Listen to user stopping the share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopRecording(uploadUrl);
      };
      
      return true;
    } catch (err) {
      console.error("Error starting screen recording:", err);
      return false;
    }
  }, [stopRecording]);

  return { isRecording, startRecording, stopRecording };
}
