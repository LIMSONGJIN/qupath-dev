import { Annotation } from "./imageviewer";

export interface ClassInfo {
  id: number;
  name: string;
  color: string;
  count: number;
}

export interface ClassManagerProps {
  classes: ClassInfo[];
  setClasses: React.Dispatch<React.SetStateAction<ClassInfo[]>>;
  setClassesUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
  classCounts: Record<string, number>;
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  setAnnotationsUnsaved: React.Dispatch<React.SetStateAction<boolean>>
}
