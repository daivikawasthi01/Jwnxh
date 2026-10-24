# Wind Forecast Day-Ahead Tool: for the trading desk

> Headline numbers are for January 2026 day-ahead decisions (09:00 cutoff on D−1, the 07:30 UTC forecast run), computed out of the live app.

## The problem

Each morning you decide how much power to buy for tomorrow, before the day-ahead auction closes at about 09:20. Wind covers a large and changing part of tomorrow's need, and the wind forecast is sometimes wrong. If wind comes in under the forecast, you are short and pay imbalance prices. If you buy too much as a hedge, you overpay.

## What the app answers

1. **"What did the wind forecast say when I had to decide?"** For any delivery day, the app shows the official national wind forecast that was available at your decision time (09:00 by default), hour by hour.
2. **"How wrong does that forecast usually get?"** For January 2026, the forecast is compared with what the wind actually produced. The typical miss is shown in MW and in percent.
3. **"How much wind can I safely count on?"** Each hour has a range: a cautious figure (**P10**) and an optimistic one (**P90**). Wind came in inside that range about 8 hours in 10.

## Headline numbers (January 2026, 09:00 decision)

| | |
|---|---|
| Typical day-ahead miss (MAE) | **2,022 MW** (18% of average wind) |
| Systematic tilt (bias) | **+1,746 MW** (over-forecast: wind came in lower than predicted in most hours; likely curtailment of constrained wind farms) |
| Bad-hour miss (90th percentile) | **4,158 MW** |
| Short-notice (4-hour-ahead) miss, for comparison | **1,808 MW** |
| Average daily wind energy | **270,852 MWh** |

## 3-minute demo script

**0:00–0:30 · Set the scene.** "Every morning we commit to a buy for tomorrow before 09:20. This tool shows the wind forecast we actually had then, and how far we can trust it."

**0:30–1:30 · Day-Ahead decision page.**
- Pick a delivery date (for example 15 January 2026). The app uses the forecast published at 07:30 the day before, the last one in time for the auction.
- Point to the forecast line and the shaded P10–P90 band. "Wind came in inside this band about 80% of the time."
- Read the summary cards: forecast energy for the day, the cautious (P10) and optimistic (P90) totals, and the peak hour.
- Turn on the actual line. "This is what really happened. On this day we missed by 1,025 MW on average."

**1:30–2:15 · Explorer page.**
- Choose a date range and a lead time (for example 4 hours or 24 hours ahead) and compare forecast with actual.
- "This is the raw evidence. You can check any hour yourself."

**2:15–3:00 · Accuracy page.**
- Error by lead time: "the further ahead, the bigger the miss. At day-ahead it is about 2,022 MW."
- Error histogram and hour-of-day profile: "these are the hours when the forecast is weakest, so be most careful there."
- Close: "this tells us how much wind to count on and how much cover to buy."

## How to use the band to size a purchase

For each hour of tomorrow:

- **Conservative position (recommended default):**
  `buy residual = demand − P10 wind`
  You count only on wind you will very probably get. You will be short in only about 1 hour in 10.
- **Central position:** `demand − forecast wind`. This is cheaper when the forecast is right, and riskier when wind falls short.
- **Aggressive position:** `demand − P90 wind`. You are often short. Use it only when imbalance prices are expected to be low.

The gap between P10 and P90 is the **cost of certainty**. Wide bands on gusty days tell you to buy more cover. Narrow bands mean you can lean on the forecast.

## Why you can trust it

- **Official data only.** Forecasts and outturn come straight from Elexon, the GB settlement body, through its public data service. Nothing in the data is adjusted by hand.
- **Fair test.** Each day's forecast is the one that really existed before the auction. Nothing published later is used.
- **Range not tuned to the day it is shown on.** The P10–P90 range for a day is built only from the *other* days of the month, so it is a fair test of how the range would have performed.
- **Transparent.** Every number can be traced back to individual hours on the Explorer page.

## What's next

1. **Daily automatic updates**, so tomorrow's forecast is ready every morning.
2. **Summer-time support**, with decision times following UK clock changes.
3. **Built-in demand forecast**, so the app shows the recommended buy residual directly.
4. **Smarter ranges** that tighten or widen with wind level and time of day.
5. **A longer track record**, covering 12 months, seasonal comparisons and whether waiting for the 09:30 run would have paid off.
