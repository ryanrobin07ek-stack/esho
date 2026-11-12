import type { PluginListenerHandle } from '@capacitor/core';

export interface ProductCutoutProgress {
  phase?: 'model' | 'frames';
  state?: string;
  done?: number;
  total?: number;
}

export interface ProductCutoutPlugin {
  processVideo(options: {
    path: string;
    count: number;
    width: number;
  }): Promise<{ frames: string[] }>;
  cutoutImages(options: {
    paths: string[];
    width: number;
  }): Promise<{ images: string[] }>;
  persistVideo(options: {
    path: string;
    extension: 'mp4' | 'webm' | 'mov';
  }): Promise<{ path: string }>;
  addListener(
    eventName: 'progress',
    listener: (event: ProductCutoutProgress) => void,
  ): Promise<PluginListenerHandle>;
}

export declare const ProductCutout: ProductCutoutPlugin;
