import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { FiveZeroPattern } from "./engine";

export const buildFiveZeroFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: FiveZeroPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const color = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const [x, a, b, c, d] = pattern.pivots;
  const patternPoints = [x, a, b, c, d].map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));

  const lines: StrategyFigureLine[] = [
    {
      id: `five-zero-pattern-${entryTimestamp}`,
      kind: `five_zero_${pattern.kind}_pattern`,
      points: patternPoints,
      color,
      width: 2,
      style: "solid",
    },
    {
      id: `five-zero-xb-${entryTimestamp}`,
      kind: "five_zero_xb_ratio",
      points: [
        { timestamp: x.timestamp, value: x.value },
        { timestamp: b.timestamp, value: b.value },
      ],
      color: "#9333ea",
      width: 1,
      style: "dashed",
    },
    {
      id: `five-zero-ac-${entryTimestamp}`,
      kind: "five_zero_ac_ratio",
      points: [
        { timestamp: a.timestamp, value: a.value },
        { timestamp: c.timestamp, value: c.value },
      ],
      color: "#9333ea",
      width: 1,
      style: "dashed",
    },
    {
      id: `five-zero-bd-${entryTimestamp}`,
      kind: "five_zero_bd_ratio",
      points: [
        { timestamp: b.timestamp, value: b.value },
        { timestamp: d.timestamp, value: d.value },
      ],
      color: "#9333ea",
      width: 1,
      style: "dashed",
    },
    {
      id: `five-zero-target-${entryTimestamp}`,
      kind: "five_zero_target",
      points: [
        { timestamp: d.timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `five-zero-stop-${entryTimestamp}`,
      kind: "five_zero_stop",
      points: [
        { timestamp: d.timestamp, value: pattern.stopLossPrice },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `five-zero-pivots-${entryTimestamp}`,
      kind: `five_zero_${pattern.kind}_pivots`,
      points: patternPoints,
      color,
      radius: 4,
    },
    {
      id: `five-zero-entry-${entryTimestamp}`,
      kind: "five_zero_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color,
      radius: 5,
    },
  ];

  return { lines, points };
};
