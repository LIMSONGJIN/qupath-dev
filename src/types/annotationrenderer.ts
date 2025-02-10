export interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

export interface AnnotationRendererProps {
  annotations: Annotation[];
  viewer: OpenSeadragon.Viewer;
  selectedAnnotation: string | null;
  setSelectedAnnotation: (id: string | null) => void;
  selectedSide: { id: string; side: string } | null;
  setSelectedSide: (side: { id: string; side: string } | null) => void;
}

export interface CustomOSDEvent extends OpenSeadragon.OSDEvent<any> {
  position: OpenSeadragon.Point;
}