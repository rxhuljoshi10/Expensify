// hooks/useVoiceRecorder.ts
import { useState } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from "expo-audio";
import { Platform } from "react-native";

export type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

const recordingOptions =
  Platform.OS === "android"
    ? ({
        extension: ".3gp",
        sampleRate: 8000,
        numberOfChannels: 1,
        bitRate: 64000,
        android: {
          outputFormat: "3gp",
          audioEncoder: "amr_nb",
        },
        ios: {
          outputFormat: IOSOutputFormat.MPEG4AAC,
          audioQuality: AudioQuality.MIN,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 64000,
        },
      } as const)
    : ({
        extension: ".wav",
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        ios: {
          outputFormat: IOSOutputFormat.LINEARPCM,
          audioQuality: AudioQuality.MAX,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          outputFormat: "default",
          audioEncoder: "default",
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      } as const);

export const useVoiceRecorder = () => {
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const recorder = useAudioRecorder(recordingOptions);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorMessage('Microphone permission denied');
        setState('error');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch (e: any) {
      setErrorMessage(e.message);
      setState('error');
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      setState('processing');

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) {
        setErrorMessage('Could not record audio.');
        setState('error');
        return null;
      }

      return uri;
    } catch (e: any) {
      setErrorMessage(e.message);
      setState('error');
      return null;
    }
  };

  const reset = () => {
    setState('idle');
    setErrorMessage('');
  };

  return { state, errorMessage, startRecording, stopRecording, reset };
};