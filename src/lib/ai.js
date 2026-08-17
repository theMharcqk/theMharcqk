export function buildSuggestPayload({ prompt, duration, talking = [], peaks = [] }) {
  return {
    prompt: String(prompt || "").slice(0, 500),
    duration: Number(duration) || 0,
    talking: talking.slice(0, 24).map((seg) => ({
      start: Number(seg.start) || 0,
      end: Number(seg.end) || 0,
      score: Number(seg.score) || 0,
    })),
    peaks: peaks.slice(0, 12).map((peak) => ({
      time: Number(peak.time) || 0,
      score: Number(peak.score) || 0,
    })),
  };
}

export function buildSuggestMessages(payload) {
  const system = `You are a fast editor for vertical 9:16 clips (TikTok/Reels/Shorts).
Return JSON only:
{"summary":"string","edits":{"captions":boolean,"speed":number},"clips":[{"start":number,"end":number,"title":"string","reason":"string","keep":true}]}
Rules:
- Times are seconds within [0, duration]
- Prefer 8-20s clips unless the user asks otherwise
- Do not overlap clips
- Use talking/peaks as hints, not as a transcript
- Titles are short on-screen captions
- speed is 0.5, 1, 1.25, or 1.5`;

  const user = JSON.stringify(payload);
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseSuggestResponse(content) {
  const text = String(content || "").trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI did not return a clip plan");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(parsed.clips)) {
    throw new Error("AI plan missing clips");
  }
  return parsed;
}
