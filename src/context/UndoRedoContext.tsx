import { createContext, useContext, useEffect, useRef } from 'react';

/** Command 인터페이스 정의 */
interface Command {
  redo: () => void; // 작업을 실제로 수행하는 로직
  undo: () => void; // 이전 상태로 되돌리는 로직
  // 필요에 따라 prevState, nextState, 작업 타입(type) 등을 여기에 추가할 수 있습니다.
}

/** Context에서 제공할 기능 정의 */
interface UndoRedoContextType {
  performCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextType | null>(null);

/** Hook 형태로 제공하여 손쉽게 사용 */
export function useUndoRedo() {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return ctx;
}

export const UndoRedoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 히스토리 스택은 렌더링과 직접적인 관련이 없으므로 useRef로 관리
  const undoStackRef = useRef<Command[]>([]);
  const redoStackRef = useRef<Command[]>([]);

  // 히스토리에 저장할 수 있는 최대 작업 개수 (필요에 따라 조정)
  const MAX_HISTORY = 50;

  /**
   * 새 작업을 실행(redo)하고 undoStack에 쌓는다.
   * Redo 스택은 새로운 작업이 들어오면 비운다.
   */
  const performCommand = (command: Command) => {
    // 새로운 작업이 들어오면 redo 스택은 초기화
    redoStackRef.current = [];

    // 작업 수행
    command.redo();

    // undoStack에 push
    undoStackRef.current.push(command);
    // 최대 개수 초과 시 오래된 항목 제거
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
  };

  /**
   * Undo 실행: undoStack에서 마지막 커맨드를 pop하여 undo를 실행
   * 그리고 redoStack에 push
   */
  const undo = () => {
    if (undoStackRef.current.length === 0) return;
    const command = undoStackRef.current.pop()!;
    command.undo();
    redoStackRef.current.push(command);
  };

  /**
   * Redo 실행: redoStack에서 마지막 커맨드를 pop하여 redo를 실행
   * 그리고 undoStack에 push
   */
  const redo = () => {
    if (redoStackRef.current.length === 0) return;
    const command = redoStackRef.current.pop()!;
    command.redo();
    undoStackRef.current.push(command);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value: UndoRedoContextType = {
    performCommand,
    undo,
    redo,
  };

  return <UndoRedoContext.Provider value={value}>{children}</UndoRedoContext.Provider>;
};
