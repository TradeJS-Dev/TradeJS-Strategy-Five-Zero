import { FiveZeroPattern } from "../engine";
import { buildFiveZeroFigures } from "../figures";

describe("FiveZero figures", () => {
  it("renders XABCD, three ratio guides, target, stop, pivots and entry", () => {
    const pattern: FiveZeroPattern = {
      setupId: "bullish-five-zero-1",
      kind: "bullish_five_zero",
      direction: "LONG",
      pivots: [
        { timestamp: 1, index: 0, value: 100, kind: "low", traded: false },
        { timestamp: 2, index: 1, value: 110, kind: "high", traded: false },
        { timestamp: 3, index: 2, value: 98, kind: "low", traded: false },
        { timestamp: 4, index: 3, value: 122, kind: "high", traded: false },
        { timestamp: 5, index: 4, value: 110, kind: "low", traded: true },
      ],
      targetPrice: 122,
      stopLossPrice: 108.8,
      xaLength: 10,
      abLength: 12,
      bcLength: 24,
      cdLength: 12,
      abXaExtension: 1.2,
      bcAbExtension: 2,
      cdBcRetracement: 0.5,
      reciprocalAbCdRatio: 1,
      patternHeightPct: 24.49,
      patternHeightAtr: 4,
      patternAgeBars: 5,
      xToABars: 1,
      aToBBars: 1,
      bToCBars: 1,
      cToDBars: 1,
      entryAfterDBars: 1,
      reversalDistancePct: 3.64,
      reversalDistanceAtr: 0.67,
      reversalDistanceCdRatio: 0.33,
      timestamp: 6,
      close: 114,
    };

    const figures = buildFiveZeroFigures({
      pattern,
      entryTimestamp: 6,
      entryPrice: 114,
    });

    expect(figures.lines).toHaveLength(6);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "five_zero_bullish_five_zero_pattern",
      "five_zero_xb_ratio",
      "five_zero_ac_ratio",
      "five_zero_bd_ratio",
      "five_zero_target",
      "five_zero_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(5);
  });
});
