import { fiveZeroAiAdapter } from "../adapters/ai";

describe("fiveZeroAiAdapter", () => {
  it("carries FiveZero geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_five_zero",
      signalDirection: "LONG",
      abXaExtension: 1.2,
      bcAbExtension: 2,
      cdBcRetracement: 0.5,
      pivots: [{ role: "X", value: 100 }],
    };
    const payload = fiveZeroAiAdapter.buildPayload!({
      signal: { additionalIndicators: { fiveZeroContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).fiveZeroContext).toEqual(
      context,
    );
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = fiveZeroAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_five_zero");
    expect(prompt).toContain("abXaExtension=1.2");
    expect(prompt).toContain("bcAbExtension=2");
    expect(prompt).toContain("cdBcRetracement=0.5");
  });
});
