import { createReferenceStudyRoom } from './reference-study-room.mjs';

/**
 * Wraps the reference-aligned 1F Study replacement while preserving the
 * { root, getState(), dispose() } contract consumed by pose-room.mjs.
 */
export function createMicroRoomDetails(model) {
  const studyRoom = createReferenceStudyRoom(model);
  let disposed = false;

  return {
    root: studyRoom.root,
    studyRoom,
    getState() {
      const state = studyRoom.getState();
      return {
        parts: state.parts,
        meshCount: state.meshCount,
        hiddenOriginalCount: state.hiddenOriginalCount,
        disposed
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      studyRoom.dispose();
    }
  };
}
