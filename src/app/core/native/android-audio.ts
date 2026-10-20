import { registerPlugin } from '@capacitor/core';

export interface AndroidAudioPlugin {
  playSound(options: { resourceName: string; volume?: number }): Promise<{ success: boolean }>;
  stopSound(): Promise<{ success: boolean }>;
  setVolume(options: { volume: number }): Promise<{ success: boolean }>;
  cancelNotification(): Promise<void>;
  setNotification(): Promise<void>;
}

const AndroidAudio = registerPlugin<AndroidAudioPlugin>('AndroidAudio');

export default AndroidAudio;
