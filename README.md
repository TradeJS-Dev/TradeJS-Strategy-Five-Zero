# @tradejs/strategy-five-zero

TradeJS strategy plugin providing `FiveZero`.

## Strategy overview

`FiveZero` detects the bullish and bearish forms of the five-pivot XABCD
harmonic reversal pattern. The detector uses confirmed wick pivots and requires
all three geometric relationships at the same time:

1. `AB / XA` is between `1.13` and `1.618`;
2. `BC / AB` is between `1.618` and `2.24`;
3. `CD / BC` is near `0.50`, with a default accepted range of `0.45–0.55`.

The bullish form is `low → high → lower low → higher high → low` across
`X → A → B → C → D` and enters long after `D` is confirmed. The bearish form
is its exact mirror and enters short. These ratios follow the published
[5-0 pattern definition](https://harmonictrader.com/harmonic-patterns/5-0/).

![FiveZero strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Five-Zero/main/docs/strategy-logic.svg)

## Signal geometry

![Bullish FiveZero signal](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Five-Zero/main/docs/signal-example.svg)

The illustrations are schematic. Defaults use a two-bar confirmed fractal,
target point `C`, place the stop 10% of `CD` beyond `D`, require at least one
ATR of `BC` pattern height, and reject an entry after the initial reaction has
moved more than 80% of `CD`. Every tolerance is explicit in the strategy config
so research can change geometry without changing detector code.

## Install

```bash
yarn add @tradejs/strategy-five-zero
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-five-zero"],
});
```

The package exports `strategyEntries`, the `FiveZero` strategy definition,
manifest, default config, and AI adapter.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow.

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads a hidden nested engine, types package, indicator package,
or Strategy Kit.
