import React, { useEffect, useState } from 'react';
import { SketchPicker } from 'react-color';
import { useUndoRedo } from '../context/UndoRedoContext';
import { ClassInfo, ClassManagerProps } from '../types/classmanager';

const ClassManager: React.FC<ClassManagerProps> = ({ selectedImageName }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [colorPickerVisible, setColorPickerVisible] = useState<number | null>(null);
  const { performCommand } = useUndoRedo();

  useEffect(() => {
    if (!selectedImageName) return;

    const fetchClasses = async () => {
      const response = await window.api.getClasses();
      if (response.success) {
        setClasses(response.classes);
      }
    };

    const updateClassCounts = async () => {
      const response = await window.api.getAnnotationsCounts(selectedImageName.replace('.png', ''));
      if (response.success) {
        setClassCounts(response.classCounts);
      }
    };

    fetchClasses();
    updateClassCounts();

    const interval = setInterval(updateClassCounts, 1000);
    return () => clearInterval(interval);
  }, [selectedImageName]);

  // 클래스 이름 변경 핸들러 (Undo/Redo 적용)
  const handleNameChange = (id: number, oldName: string, newName: string) => {
    if (oldName === 'Unclassified' || oldName === newName) return;

    performCommand({
      redo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, name: newName } : cls));
          window.api.updateClasses(updated);
          window.api.updateAnnotationsClassname(oldName, newName);
          return updated;
        });
      },
      undo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, name: oldName } : cls));
          window.api.updateClasses(updated);
          window.api.updateAnnotationsClassname(newName, oldName);
          return updated;
        });
      },
    });
  };

  // 클래스 색상 변경 핸들러 (Undo/Redo 적용)
  const handleColorChange = (id: number, newColor: string) => {
    const targetClass = classes.find((cls) => cls.id === id);
    if (!targetClass || targetClass.color === newColor) return;
    const oldColor = targetClass.color;

    performCommand({
      redo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, color: newColor } : cls));
          window.api.updateClasses(updated);
          return updated;
        });
      },
      undo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, color: oldColor } : cls));
          window.api.updateClasses(updated);
          return updated;
        });
      },
    });
  };

  return (
    <div style={{ padding: '10px', backgroundColor: '#222', color: '#fff', borderRadius: '8px' }}>
      <h3 style={{ textAlign: 'center' }}>Class Management</h3>
      {classes.map((cls) => (
        <div
          key={cls.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            position: 'relative',
          }}
        >
          {/* 클래스 이름 입력 */}
          <input
            type="text"
            value={cls.name}
            disabled={cls.name === 'Unclassified'}
            onChange={(e) => handleNameChange(cls.id, cls.name, e.target.value)}
            onKeyDown={(e) => {
              // Delete 키는 전파되도록 허용
              if (e.key !== 'Delete') {
                e.stopPropagation();
              }
            }}
            style={{
              marginRight: '10px',
              width: '100px',
              backgroundColor: cls.name === 'Unclassified' ? '#555' : '#fff',
              color: cls.name === 'Unclassified' ? '#aaa' : '#000',
            }}
          />

          {/* 색상 선택기 트리거 */}
          <div
            onClick={() => setColorPickerVisible(cls.id === colorPickerVisible ? null : cls.id)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '4px',
              backgroundColor: cls.color,
              cursor: 'pointer',
              border: '1px solid #ccc',
              marginRight: '10px',
            }}
          />

          {/* 어노테이션 개수 표시 */}
          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            {classCounts[cls.name] || 0}
          </span>

          {/* react-color SketchPicker (고정된 위치) */}
          {colorPickerVisible === cls.id && (
            <div
              style={{
                position: 'absolute',
                zIndex: 100,
                left: '-20px',
                top: '40px',
                width: '100%',
              }}
            >
              <SketchPicker
                color={cls.color}
                onChange={(newColor) => handleColorChange(cls.id, newColor.hex)}
                width="100%"
              />
              <button
                onClick={() => setColorPickerVisible(null)}
                style={{
                  marginTop: '5px',
                  backgroundColor: '#555',
                  color: '#fff',
                  border: 'none',
                  padding: '5px',
                  cursor: 'pointer',
                  width: '100%',
                  borderRadius: '4px',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ClassManager;
