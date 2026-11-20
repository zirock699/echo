import type { TranscriptCue } from "../types";

export const parseSRT = (content: string): TranscriptCue[] => {
  const cues: TranscriptCue[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  blocks.forEach((block, index) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return;

    // Skip the sequence number (first line is typically the cue number)
    let timeLine = lines[0];
    let textStart = 1;

    // If first line looks like a number, the actual time is on the second line
    if (/^\d+$/.test(timeLine)) {
      timeLine = lines[1];
      textStart = 2;
    }

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);

    if (!timeMatch) return;

    const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    const text = lines.slice(textStart).join("\n").trim();

    if (text && startTime < endTime) {
      cues.push({
        id: `cue-${index}`,
        startTime,
        endTime,
        text,
      });
    }
  });

  return cues;
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
};
