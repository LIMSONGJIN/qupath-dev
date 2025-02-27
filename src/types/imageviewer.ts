import { ClassInfo } from './classmanager';

export interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

export interface ImageViewerProps {
  imageUrl: string;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>; // 상태 업데이트 함수
  classes: ClassInfo[];
  setAnnotationsUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}
