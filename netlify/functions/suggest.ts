import type { Config } from "@netlify/functions";
import OpenAI from "openai";
import { buildSuggestMessages, parseSuggestResponse } from "../../src/lib/ai.js";
import { normalizePlan } from "../../src/lib/plan.js";

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors() });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: cors() });
  }

  let body: {
    prompt?: string;
    duration?: number;
    talking?: { start: number; end: number; score?: number }[];
    peaks?: { time: number; score?: number }[];
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors() });
  }

  const duration = Number(body.duration) || 0;
  if (duration <= 0) {
    return Response.json({ error: "Video duration required" }, { status: 400, headers: cors() });
  }

  const key = Netlify.env.get("OPENAI_API_KEY") || Netlify.env.get("NETLIFY_AI_GATEWAY_KEY");
  if (!key) {
    return Response.json(
      { error: "AI gateway unavailable", fallback: true },
      { status: 503, headers: cors() },
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
    return Response.json(plan, { headers: cors() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suggest failed";
    return Response.json({ error: message, fallback: true }, { status: 503, headers: cors() });
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const config: Config = {
  path: "/api/suggest",
  method: ["POST", "OPTIONS"],
};
