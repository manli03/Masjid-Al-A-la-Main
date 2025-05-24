import { registerPlugin } from '@capacitor/core';

export interface AndroidAudioPlugin {
  playSound(options: { resourceName: string }): Promise<{ success: boolean }>;
  stopSound(): Promise<{ success: boolean }>;
  cancelNotification(): Promise<void>;
}

const AndroidAudio = registerPlugin<AndroidAudioPlugin>('AndroidAudio');

export default AndroidAudio;
