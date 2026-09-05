import { StrategyManifest } from "@tradejs/types";
import { fiveZeroAiAdapter } from "./adapters/ai";

export const fiveZeroManifest: StrategyManifest = {
  name: "FiveZero",
  aiAdapter: fiveZeroAiAdapter,
};
