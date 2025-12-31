"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, X } from "lucide-react";

export default function VoiceRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event?.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream?.getTracks()?.forEach(track => track?.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playPreview = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
      // Cleanup
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setDuration(0);
    setIsPlaying(false);
    onCancel();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Voice Message
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!audioBlob ? (
          <div className="text-center py-8">
            {isRecording ? (
              <>
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <p className="text-2xl font-mono text-gray-900 dark:text-white mb-2">
                  {formatTime(recordingTime)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recording...
                </p>
                <button
                  onClick={stopRecording}
                  className="mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center gap-2 mx-auto transition-colors"
                >
                  <Square className="w-5 h-5" />
                  Stop Recording
                </button>
              </>
            ) : (
              <>
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Tap to start recording
                </p>
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center gap-2 mx-auto transition-colors"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="py-4">
            <div className="mb-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e?.target?.duration || 0)}
                className="w-full"
              />
              <div className="flex items-center gap-4">
                <button
                  onClick={playPreview}
                  className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Duration: {formatTime(Math.floor(duration || recordingTime))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

