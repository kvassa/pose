const FATIGUE_MS = 45_000;

type Candidate = { id: string };

/**
 * If the same cue stays on screen for 45s, suppress it and skip to the next
 * issue. Blocks clear once that issue is no longer present (user fixed it).
 */
export function createFatigueTracker(fatigueMs = FATIGUE_MS) {
  const blocked = new Set<string>();
  let activeId: string | null = null;
  let activeSince = 0;

  function sync(candidates: Candidate[]) {
    const present = new Set(candidates.map((c) => c.id));
    for (const id of [...blocked]) {
      if (!present.has(id)) blocked.delete(id);
    }
  }

  function pick<T extends Candidate>(candidates: T[]): T | null {
    sync(candidates);
    const available = candidates.filter((c) => !blocked.has(c.id));
    if (available.length === 0) {
      activeId = null;
      return null;
    }

    const now = Date.now();
    let top = available[0];

    if (top.id !== activeId) {
      activeId = top.id;
      activeSince = now;
      return top;
    }

    if (now - activeSince >= fatigueMs) {
      blocked.add(top.id);
      const rest = candidates.filter((c) => !blocked.has(c.id));
      if (rest.length === 0) {
        activeId = null;
        return null;
      }
      top = rest[0];
      activeId = top.id;
      activeSince = now;
      return top;
    }

    return top;
  }

  function reset() {
    blocked.clear();
    activeId = null;
    activeSince = 0;
  }

  return { pick, reset };
}
