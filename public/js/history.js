// Undo / redo on document snapshots (JSON strings). Selection and highlights are not part
// of the document, so they never create steps. A gesture (drag, editing a field) between
// begin() and end() becomes a single step.
export function createHistory(limit = 100) {
  let undo = [], redo = [];
  let last = null;     // snapshot of the current document
  let depth = 0;       // open gestures
  let source = null;   // () => snapshot, used when a gesture ends

  const h = {
    setSource(fn) { source = fn; },
    reset(snap) { undo = []; redo = []; last = snap; depth = 0; },
    record(snap) {
      if (depth > 0 || snap === last) return;
      if (last !== null) {
        undo.push(last);
        if (undo.length > limit) undo.shift();
      }
      redo = [];
      last = snap;
    },
    begin() { depth++; },
    end() {
      if (depth === 0) return;
      depth--;
      if (depth === 0 && source) h.record(source());
    },
    // → snapshot to restore, or null
    undo() {
      if (!undo.length) return null;
      redo.push(last);
      last = undo.pop();
      return last;
    },
    redo() {
      if (!redo.length) return null;
      undo.push(last);
      last = redo.pop();
      return last;
    },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    // Whole stacks, to keep a separate history per room.
    dump: () => ({ undo, redo, last }),
    load(d) { ({ undo, redo, last } = d); depth = 0; }
  };
  return h;
}

export const history = createHistory();
