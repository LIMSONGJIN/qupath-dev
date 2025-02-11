export interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

export interface BBoxCreatorProps {
  viewer: OpenSeadragon.Viewer;
  imageFileName: string;
  setSelectedAnnotation: (id: string | null) => void;
}

export interface CustomMouseTrackerEvent extends OpenSeadragon.MouseTrackerEvent {
  position: OpenSeadragon.Point;
}
