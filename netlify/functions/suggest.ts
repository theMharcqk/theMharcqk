import type { Config } from "@netlify/functions";
import OpenAI from "openai";
import { buildSuggestMessages, parseSuggestResponse } from "../../src/lib/ai.js";
import { isSameOrigin, MAX_SUGGEST_BODY } from "../../src/lib/origin.js";
import { normalizePlan } from "../../src/lib/plan.js";

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: headers() });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: headers() });
  }
  if (!isSameOrigin(req.url, req.headers.get("origin"))) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: headers() });
  }

  let body: {
    prompt?: string;
    duration?: number;
    talking?: { start: number; end: number; score?: number }[];
    peaks?: { time: number; score?: number }[];
  };

  try {
    const raw = await req.text();
    if (raw.length > MAX_SUGGEST_BODY) {
      return Response.json({ error: "Payload too large" }, { status: 413, headers: headers() });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: headers() });
  }

  const duration = Number(body.duration) || 0;
  if (duration <= 0) {
    return Response.json({ error: "Video duration required" }, { status: 400, headers: headers() });
  }

  const key = Netlify.env.get("OPENAI_API_KEY") || Netlify.env.get("NETLIFY_AI_GATEWAY_KEY");
  if (!key) {
    return Response.json(
      { error: "AI gateway unavailable", fallback: true },
      { status: 503, headers: headers() },
    );
  }

  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: buildSuggestMessages({
        prompt: body.prompt || "",
        duration,
        talking: body.talking || [],
        peaks: body.peaks || [],
      }),
    });

    const parsed = parseSuggestResponse(completion.choices[0]?.message?.content);
    const plan = normalizePlan({ ...parsed, source: "ai" }, duration);
    return Response.json(plan, { headers: headers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suggest failed";
    return Response.json({ error: message, fallback: true }, { status: 503, headers: headers() });
  }
};

function headers() {
  return { "Cache-Control": "no-store" };
}

export const config: Config = {
  path: "/api/suggest",
  method: ["POST", "OPTIONS"],
};
