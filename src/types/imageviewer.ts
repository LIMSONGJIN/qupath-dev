export interface Annotation {
    id: string;
    bbox: [number, number, number, number];
    class: string;
  }
  
export interface ImageViewerProps {
    imageUrl: string;
    annotations: Annotation[];
  }