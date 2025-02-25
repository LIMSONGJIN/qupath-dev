export interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

export interface AnnotationRendererProps {
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  viewer: OpenSeadragon.Viewer;
  selectedAnnotations: string[]; // 배열 형태로 변경
  setSelectedAnnotations: (ids: string[]) => void; // 배열로 전달받는 함수
  selectedSide: { id: string; side: string } | null;
  setSelectedSide: (side: { id: string; side: string } | null) => void;
  imageFileName: string;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface CustomOSDEvent extends OpenSeadragon.OSDEvent<any> {
  [x: string]: any;
  position: OpenSeadragon.Point;
}
