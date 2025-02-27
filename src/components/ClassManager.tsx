import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import { useUndoRedo } from '../context/UndoRedoContext';
import { ClassManagerProps } from '../types/classmanager';

const ClassManager: React.FC<ClassManagerProps> = ({
  classes,
  setClasses,
  setClassesUnsaved,
  classCounts,
}) => {
  const [colorPickerVisible, setColorPickerVisible] = useState<number | null>(null);
  const { performCommand } = useUndoRedo();

  // 클래스 이름 변경 핸들러 (Undo/Redo 적용)
  const handleNameChange = (id: number, oldName: string, newName: string) => {
    if (oldName === 'Unclassified' || oldName === newName) return;

    performCommand({
      redo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, name: newName } : cls));
          // API 호출 대신 unsaved 플래그 설정
          setClassesUnsaved(true);
          return updated;
        });
      },
      undo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, name: oldName } : cls));
          setClassesUnsaved(true);
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
          setClassesUnsaved(true);
          return updated;
        });
      },
      undo: () => {
        setClasses((prev) => {
          const updated = prev.map((cls) => (cls.id === id ? { ...cls, color: oldColor } : cls));
          setClassesUnsaved(true);
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

          {/* react-color SketchPicker */}
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
                onChange={(newColor: { hex: string }) => handleColorChange(cls.id, newColor.hex)}
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
