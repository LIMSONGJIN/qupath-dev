import { ReactNode } from 'react';

export interface ImageInfo {
  height: ReactNode;
  width: ReactNode;
  url: string;
  name: string;
}

export interface Annotation {
  id: string;
  bbox: [number, number, number, number]; // [centerX, centerY, width, height]
  class: string;
}
