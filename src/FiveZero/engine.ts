import { Candle, Direction } from "@tradejs/types";
import { FiveZeroConfig } from "./config";

export type FiveZeroPatternKind = "bullish_five_zero" | "bearish_five_zero";
export type FiveZeroPivotRole = "X" | "A" | "B" | "C" | "D";

export interface FiveZeroPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface FiveZeroPattern {
  setupId: string;
  kind: FiveZeroPatternKind;
  direction: Direction;
  pivots: [
    FiveZeroPivot,
    FiveZeroPivot,
    FiveZeroPivot,
    FiveZeroPivot,
    FiveZeroPivot,
  ];
  targetPrice: number;
  stopLossPrice: number;
  xaLength: number;
  abLength: number;
  bcLength: number;
  cdLength: number;
  abXaExtension: number;
  bcAbExtension: number;
  cdBcRetracement: number;
  reciprocalAbCdRatio: number;
  patternHeightPct: number;
  patternHeightAtr: number;
  patternAgeBars: number;
  xToABars: number;
  aToBBars: number;
  bToCBars: number;
  cToDBars: number;
  entryAfterDBars: number;
  reversalDistancePct: number;
  reversalDistanceAtr: number;
  reversalDistanceCdRatio: number;
  timestamp: number;
  close: number;
}

export interface FiveZeroRuntimeState {
  pattern: FiveZeroPattern | null;
  pivots: FiveZeroPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: FiveZeroPivot[];
  pattern: FiveZeroPattern | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getConfigNumbers = (config: FiveZeroConfig) => {
  const minAbXaExtension = Math.max(
    0,
    Number(config.FIVE_ZERO_MIN_AB_XA_EXTENSION ?? 1.13),
  );
  const minBcAbExtension = Math.max(
    0,
    Number(config.FIVE_ZERO_MIN_BC_AB_EXTENSION ?? 1.618),
  );
  const minCdBcRetracement = Math.max(
    0,
    Number(config.FIVE_ZERO_MIN_CD_BC_RETRACEMENT ?? 0.45),
  );

  return {
    pivotLength: Math.max(1, Math.floor(config.FIVE_ZERO_PIVOT_LENGTH ?? 2)),
    minAbXaExtension,
    maxAbXaExtension: Math.max(
      minAbXaExtension,
      Number(config.FIVE_ZERO_MAX_AB_XA_EXTENSION ?? 1.618),
    ),
    minBcAbExtension,
    maxBcAbExtension: Math.max(
      minBcAbExtension,
      Number(config.FIVE_ZERO_MAX_BC_AB_EXTENSION ?? 2.24),
    ),
    minCdBcRetracement,
    maxCdBcRetracement: Math.max(
      minCdBcRetracement,
      Number(config.FIVE_ZERO_MAX_CD_BC_RETRACEMENT ?? 0.55),
    ),
    targetCdPct: Math.max(0, Number(config.FIVE_ZERO_TARGET_CD_PCT ?? 100)),
    stopCdPct: Math.max(0, Number(config.FIVE_ZERO_STOP_CD_PCT ?? 10)),
    minPatternHeightPct: Math.max(
      0,
      Number(config.FIVE_ZERO_MIN_PATTERN_HEIGHT_PCT ?? 0),
    ),
    minPatternHeightAtr: Math.max(
      0,
      Number(config.FIVE_ZERO_MIN_PATTERN_HEIGHT_ATR ?? 0),
    ),
    atrPeriod: Math.max(2, Math.floor(config.FIVE_ZERO_ATR_PERIOD ?? 14)),
    minLegBars: Math.max(1, Math.floor(config.FIVE_ZERO_MIN_LEG_BARS ?? 1)),
    maxPatternAgeBars: Math.max(
      5,
      Math.floor(config.FIVE_ZERO_MAX_PATTERN_AGE_BARS ?? 240),
    ),
    maxEntryAfterDBars: Math.max(
      1,
      Math.floor(config.FIVE_ZERO_MAX_ENTRY_AFTER_D_BARS ?? 8),
    ),
    minReversalDistanceAtr: Math.max(
      0,
      Number(config.FIVE_ZERO_MIN_REVERSAL_DISTANCE_ATR ?? 0),
    ),
    maxReversalDistanceCdRatio: Math.max(
      0,
      Number(config.FIVE_ZERO_MAX_REVERSAL_DISTANCE_CD_RATIO ?? 0),
    ),
  };
};

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
};

const appendPivot = (state: EngineState, pivot: FiveZeroPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 20) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value == null) ||
    lows.some((value) => value == null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const pivotKindsForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["low", "high", "low", "high", "low"] as const)
    : (["high", "low", "high", "low", "high"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): FiveZeroPattern["pivots"] | null => {
  const kinds = pivotKindsForDirection(direction);
  const firstCandidate = Math.max(0, state.pivots.length - 8);

  for (
    let index = state.pivots.length - kinds.length;
    index >= firstCandidate;
    index -= 1
  ) {
    const candidate = state.pivots.slice(index, index + kinds.length);
    if (
      candidate.length === kinds.length &&
      candidate.every((pivot, roleIndex) => pivot.kind === kinds[roleIndex]) &&
      candidate[4]!.index < state.currentIndex &&
      !candidate[4]!.traded
    ) {
      return candidate as FiveZeroPattern["pivots"];
    }
  }

  return null;
};

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markConsumed = (
  state: EngineState,
  setupId: string,
  d: FiveZeroPivot,
) => {
  if (!hasConsumed(state, setupId)) {
    state.consumedSetupIds.push(setupId);
    if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  }
  const storedD = state.pivots.find(
    (pivot) => pivot.timestamp === d.timestamp && pivot.kind === d.kind,
  );
  if (storedD) storedD.traded = true;
};

const RATIO_EPSILON = 1e-9;

const isBetween = (value: number, min: number, max: number) =>
  value >= min - RATIO_EPSILON && value <= max + RATIO_EPSILON;

const buildPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): FiveZeroPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const [x, a, b, c, d] = pivots;
  const sign = direction === "LONG" ? 1 : -1;
  const xaLength = (a.value - x.value) * sign;
  const abLength = (a.value - b.value) * sign;
  const bcLength = (c.value - b.value) * sign;
  const cdLength = (c.value - d.value) * sign;
  if (xaLength <= 0 || abLength <= 0 || bcLength <= 0 || cdLength <= 0) {
    return null;
  }

  const xToABars = a.index - x.index;
  const aToBBars = b.index - a.index;
  const bToCBars = c.index - b.index;
  const cToDBars = d.index - c.index;
  if (Math.min(xToABars, aToBBars, bToCBars, cToDBars) < options.minLegBars) {
    return null;
  }

  const abXaExtension = abLength / xaLength;
  const bcAbExtension = bcLength / abLength;
  const cdBcRetracement = cdLength / bcLength;
  if (
    !isBetween(
      abXaExtension,
      options.minAbXaExtension,
      options.maxAbXaExtension,
    ) ||
    !isBetween(
      bcAbExtension,
      options.minBcAbExtension,
      options.maxBcAbExtension,
    ) ||
    !isBetween(
      cdBcRetracement,
      options.minCdBcRetracement,
      options.maxCdBcRetracement,
    )
  ) {
    return null;
  }

  const patternAgeBars = state.currentIndex - x.index;
  const entryAfterDBars = state.currentIndex - d.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    entryAfterDBars > options.maxEntryAfterDBars
  ) {
    return null;
  }

  const patternHeightPct =
    b.value !== 0 ? (bcLength / Math.abs(b.value)) * 100 : 0;
  const patternHeightAtr = atr != null && atr > 0 ? bcLength / atr : 0;
  if (
    patternHeightPct < options.minPatternHeightPct ||
    patternHeightAtr < options.minPatternHeightAtr
  ) {
    return null;
  }

  const close = asNumber(candle.close);
  if (close == null) return null;
  const reversalDistance = (close - d.value) * sign;
  if (reversalDistance <= 0) return null;
  const reversalDistancePct =
    d.value !== 0 ? (reversalDistance / Math.abs(d.value)) * 100 : 0;
  const reversalDistanceAtr =
    atr != null && atr > 0 ? reversalDistance / atr : 0;
  const reversalDistanceCdRatio = reversalDistance / cdLength;
  if (
    reversalDistanceAtr < options.minReversalDistanceAtr ||
    (options.maxReversalDistanceCdRatio > 0 &&
      reversalDistanceCdRatio > options.maxReversalDistanceCdRatio)
  ) {
    return null;
  }

  const kind: FiveZeroPatternKind =
    direction === "LONG" ? "bullish_five_zero" : "bearish_five_zero";
  const setupId = `${kind}:${x.timestamp}:${a.timestamp}:${b.timestamp}:${c.timestamp}:${d.timestamp}`;
  if (hasConsumed(state, setupId)) return null;

  const pattern: FiveZeroPattern = {
    setupId,
    kind,
    direction,
    pivots,
    targetPrice: d.value + sign * cdLength * (options.targetCdPct / 100),
    stopLossPrice: d.value - sign * cdLength * (options.stopCdPct / 100),
    xaLength,
    abLength,
    bcLength,
    cdLength,
    abXaExtension,
    bcAbExtension,
    cdBcRetracement,
    reciprocalAbCdRatio: abLength / cdLength,
    patternHeightPct,
    patternHeightAtr,
    patternAgeBars,
    xToABars,
    aToBBars,
    bToCBars,
    cToDBars,
    entryAfterDBars,
    reversalDistancePct,
    reversalDistanceAtr,
    reversalDistanceCdRatio,
    timestamp: candle.timestamp,
    close,
  };
  markConsumed(state, setupId, d);
  return pattern;
};

export const buildFiveZeroSignalContext = (pattern: FiveZeroPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  xaLength: pattern.xaLength,
  abLength: pattern.abLength,
  bcLength: pattern.bcLength,
  cdLength: pattern.cdLength,
  abXaExtension: pattern.abXaExtension,
  bcAbExtension: pattern.bcAbExtension,
  cdBcRetracement: pattern.cdBcRetracement,
  reciprocalAbCdRatio: pattern.reciprocalAbCdRatio,
  patternHeightPct: pattern.patternHeightPct,
  patternHeightAtr: pattern.patternHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  xToABars: pattern.xToABars,
  aToBBars: pattern.aToBBars,
  bToCBars: pattern.bToCBars,
  cToDBars: pattern.cToDBars,
  entryAfterDBars: pattern.entryAfterDBars,
  reversalDistancePct: pattern.reversalDistancePct,
  reversalDistanceAtr: pattern.reversalDistanceAtr,
  reversalDistanceCdRatio: pattern.reversalDistanceCdRatio,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: (["X", "A", "B", "C", "D"] as FiveZeroPivotRole[])[index],
    timestamp,
    value,
    kind,
  })),
});

export type FiveZeroSignalContext = ReturnType<
  typeof buildFiveZeroSignalContext
>;

export const createFiveZeroEngine = ({
  config,
  initialCandles = [],
}: {
  config: FiveZeroConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => FiveZeroRuntimeState;
  getState: () => FiveZeroRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars + options.pivotLength * 2 + 6,
    options.atrPeriod + 2,
  );

  const snapshot = (): FiveZeroRuntimeState => ({
    pattern: state.pattern
      ? { ...state.pattern, pivots: [...state.pattern.pivots] }
      : null,
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): FiveZeroRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    state.pattern =
      buildPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
