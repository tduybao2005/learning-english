/**
 * TOEIC Listening raw-score -> scaled-score (5-495) estimate.
 *
 * ETS has never published an official raw-to-scaled conversion table (the
 * real conversion varies slightly per test form). This uses a commonly cited
 * prep-book-style conversion curve as an ESTIMATE only — surfaced in the UI
 * as such (see `PlacementAttempt.toeicListeningScore` and the result page).
 * Pure (no I/O), same shape/philosophy as `lib/band.ts`'s `BandTableRow`.
 */

interface ToeicScoreRow {
  min: number;
  score: number;
}

const TOEIC_LISTENING_TABLE: ToeicScoreRow[] = [
  { min: 0, score: 5 },
  { min: 5, score: 35 },
  { min: 10, score: 65 },
  { min: 15, score: 95 },
  { min: 20, score: 120 },
  { min: 25, score: 145 },
  { min: 30, score: 170 },
  { min: 35, score: 195 },
  { min: 40, score: 220 },
  { min: 45, score: 240 },
  { min: 50, score: 255 },
  { min: 55, score: 275 },
  { min: 60, score: 295 },
  { min: 65, score: 315 },
  { min: 70, score: 350 },
  { min: 75, score: 385 },
  { min: 80, score: 410 },
  { min: 85, score: 435 },
  { min: 90, score: 455 },
  { min: 95, score: 475 },
  { min: 100, score: 495 },
];

/** Converts a raw TOEIC Listening score (out of 100) into an estimated
 * scaled score (5-495), clamping out-of-range input to the table's bounds. */
export function rawToToeicListening(raw: number): number {
  const clamped = Math.min(Math.max(raw, 0), 100);
  let score = TOEIC_LISTENING_TABLE[0].score;
  for (const row of TOEIC_LISTENING_TABLE) {
    if (clamped >= row.min) score = row.score;
    else break;
  }
  return score;
}
