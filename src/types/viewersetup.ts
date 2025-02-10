export interface ViewerSetupProps {
  imageUrl: string;
  viewerRef: React.MutableRefObject<OpenSeadragon.Viewer | null>;
  setIsViewerReady: (ready: boolean) => void;
  setImageWidth: (width: number) => void;
  setIsToolbarVisible: (visible: boolean) => void;
}