export interface ImageInfo {
    url: string;
    name: string;
  }
  
export interface Annotation {
    id: string;
    bbox: [number, number, number, number]; // [centerX, centerY, width, height]
    class: string;
  }