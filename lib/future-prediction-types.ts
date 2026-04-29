import { z } from "zod";

export const futurePredictionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  probability: z.enum(["low", "medium", "high"]),
  horizon: z.enum(["next scene", "soon", "later"]),
  tone: z.enum(["danger", "opportunity", "mystery", "character", "quest"]),
  involvedNodeIds: z.array(z.string()).default([]),
  evidence: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        reason: z.string().min(1),
      })
    )
    .default([]),
  playerLevers: z.array(z.string()).default([]),
  risk: z.string().nullable().default(null),
});

export const futurePredictionResponseSchema = z.object({
  predictions: z.array(futurePredictionSchema).min(1).max(24),
});

export type FuturePrediction = z.infer<typeof futurePredictionSchema>;
