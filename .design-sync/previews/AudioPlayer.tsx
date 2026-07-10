import { AudioPlayer } from "web";

// A 0.1s silent WAV, inlined so the card never depends on the network.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==";

export const Compact = () => (
  <div className="w-96">
    <AudioPlayer src={SILENT_WAV} variant="compact" />
  </div>
);

export const Full = () => (
  <div className="w-96">
    <AudioPlayer src={SILENT_WAV} variant="full" />
  </div>
);
