import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { FiveZeroConfig } from "../config";

export const fiveZeroAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        fiveZeroContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.fiveZeroContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.fiveZeroContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional FiveZero context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- abXaExtension=${String(context.abXaExtension ?? "n/a")}
- bcAbExtension=${String(context.bcAbExtension ?? "n/a")}
- cdBcRetracement=${String(context.cdBcRetracement ?? "n/a")}
- reciprocalAbCdRatio=${String(context.reciprocalAbCdRatio ?? "n/a")}
- entryAfterDBars=${String(context.entryAfterDBars ?? "n/a")}
- reversalDistanceCdRatio=${String(context.reversalDistanceCdRatio ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for FiveZero:
- A bullish FiveZero is low-high-lower-low-higher-high-low across X-A-B-C-D and reverses upward from D.
- A bearish FiveZero is the exact mirror image and reverses downward from D.
- AB/XA must be 1.13-1.618, BC/AB must be 1.618-2.24, and CD/BC must stay near 0.50.
- Treat the ratios as one geometry check, not as independent entry signals, and reject analysis that contradicts the signal direction.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<
        FiveZeroConfig,
        "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY"
      >,
    ),
};
