/**
 * Pure index math for rendering a flat forward-only runner (reducer.ts) as
 * "Phần 1..N" sections. `counts` = questions per section, in order.
 */
export function sectionStartIndexes(counts: number[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const c of counts) {
    starts.push(acc);
    acc += c;
  }
  return starts;
}

export function sectionIndexForQuestion(counts: number[], flatIndex: number): number {
  let acc = 0;
  for (let s = 0; s < counts.length; s++) {
    acc += counts[s];
    if (flatIndex < acc) return s;
  }
  return Math.max(0, counts.length - 1);
}

export function questionIndexInSection(counts: number[], flatIndex: number): number {
  const s = sectionIndexForQuestion(counts, flatIndex);
  return flatIndex - sectionStartIndexes(counts)[s];
}

/** Sections fully answered: all when finished, else those strictly before flatIndex. */
export function completedSectionCount(
  counts: number[],
  flatIndex: number,
  finished: boolean,
): number {
  if (finished) return counts.length;
  let acc = 0;
  let done = 0;
  for (const c of counts) {
    acc += c;
    if (flatIndex >= acc) done++;
    else break;
  }
  return done;
}
