export interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

export interface BBoxCreatorProps {
  viewer: OpenSeadragon.Viewer;
  imageFileName: string;
  setSelectedAnnotations: (ids: string[]) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  setAnnotationsUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface CustomMouseTrackerEvent extends OpenSeadragon.MouseTrackerEvent {
  position: OpenSeadragon.Point;
}
