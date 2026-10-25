# BTC Price Drivers — Master List

Created: 2026-10-25. Everything here is measurable and can be put on a chart.

## How to read this list

- **Evidence**: how strong the link to BTC price is.
  - **A** = strong, many cycles, widely tracked.
  - **B** = medium, real but loose or few data points.
  - **C** = weak / fringe / folklore. Kept because traders watch it. Do not trust alone.
- **Horizon**: S = short (hours–weeks), M = medium (weeks–months), L = long (months–years).
- **Chart type** (for the build):
  - `EVENT` = vertical line on a date.
  - `ZONE` = shaded time period.
  - `OVERLAY` = line on the price chart.
  - `PANE` = separate panel under price.
- Correlation is not cause. Many items below move together because of one thing: **liquidity**.

---

## 1. Bitcoin supply cycle (the "4-year cycle")

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 1.1 | **Halving dates** | Block reward cut 50% every 210,000 blocks | L | A | EVENT | Block height (mempool.space) |
| 1.2 | **Halving countdown** | Blocks / days to next halving | L | A | PANE | Block height |
| 1.3 | **Cycle peak timing** | Days from halving to cycle top | L | B | ZONE | Price history |
| 1.4 | **Cycle bottom timing** | Days from top to bottom | L | B | ZONE | Price history |
| 1.5 | **Peak-to-bottom drawdown** | % drop each bear market | L | B | PANE | Price history |
| 1.6 | **Issuance / inflation rate** | New BTC per day, % supply growth | L | A | PANE | On-chain |
| 1.7 | **Stock-to-Flow (S2F)** | Supply ÷ new issuance model | L | C (model broke 2021–22) | OVERLAY | On-chain |
| 1.8 | **Supply on exchanges** | BTC held on exchanges (less = less to sell) | M | B | PANE | Glassnode / CryptoQuant |
| 1.9 | **Illiquid supply** | Coins in wallets that rarely sell | M–L | B | PANE | Glassnode |

**Verified history (halving → peak → bottom):**

| Halving | Block | Date | Next peak | Months after halving | Next bottom | Drawdown |
|---|---|---|---|---|---|---|
| 1st | 210,000 | 2012-11-28 | Dec 2013 (~$1,150) | ~12 | Jan 2015 (~$170) | ~-85% |
| 2nd | 420,000 | 2016-07-09 | 2017-12-17 (~$19.7k) | ~17 | 2018-12-15 (~$3.2k) | ~-84% |
| 3rd | 630,000 | 2020-05-11 | 2021-11-10 (~$69k) | ~18 | 2022-11-21 (~$15.5k) | ~-77% |
| 4th | 840,000 | 2024-04-20 | 2025-10-06 (~$126k) | ~17.5 | not confirmed yet | — |
| 5th | 1,050,000 | ~Apr 2028 (estimate) | — | — | — | — |

Notes:
- Pattern: peak ~12–18 months after halving. Bottom ~12–13 months after peak.
- 2025 peak ~$126k on 2025-10-06 (CoinGecko). Mid-Aug 2026 reports put BTC ~$63–65k (~50% down). Current price not verified.
- Debate: some (Fidelity's Jurrien Timmer) say Oct 2025 ended the 4-year cycle on schedule. Others say ETFs broke the cycle. Unsettled.

---

## 2. Central bank money (QE / QT and its other names)

QE and QT have many names. All mean "central bank adds money" or "removes money".

| # | Item | Other names | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 2.1 | **Fed balance sheet** | QE, QT, "balance sheet runoff", "reserve management purchases (RMP)", "not-QE", BTFP | M–L | A | OVERLAY | FRED `WALCL` |
| 2.2 | **Fed Net Liquidity** | Balance sheet − TGA − Reverse Repo | S–M | A | OVERLAY | FRED `WALCL` − `WTREGEN` − `RRPONTSYD` |
| 2.3 | **Treasury General Account (TGA)** | Government's cash account. Rising TGA drains money | S–M | B | PANE | FRED `WTREGEN` |
| 2.4 | **Reverse Repo (RRP)** | Money parked at Fed. Draining RRP adds liquidity | S–M | B | PANE | FRED `RRPONTSYD` |
| 2.5 | **US M2 money supply** | Total dollars in system | M–L | A | OVERLAY | FRED `M2SL` |
| 2.6 | **Global M2 / Global liquidity** | US + China + EU + Japan + UK M2 in USD | M–L | A– (lead time claimed ~2–3 months, not stable) | OVERLAY | TradingView ECONOMICS tickers / CrossBorder Capital |
| 2.7 | **Fed funds rate** | Rate hikes / cuts | M–L | A | PANE | FRED `FEDFUNDS` |
| 2.8 | **Rate expectations** | Market odds of next cut/hike | S | B | PANE | CME FedWatch |
| 2.9 | **Other central banks** | ECB, BoJ (yen carry trade), PBoC (China stimulus), BoE | S–L | B | EVENT | Central bank sites |
| 2.10 | **Liquidity cycle (~5–6 yrs)** | Michael Howell's global liquidity cycle (~65 months claimed) | L | B | ZONE | CrossBorder Capital |

**Verified Fed timeline (for EVENT/ZONE markers):**

| Period | Action | BTC context |
|---|---|---|
| 2017-10 → 2019-08 | QT1 | 2018 bear market |
| 2020-03 | QE4 (huge, COVID) | Start of 2020–21 bull |
| 2022-03 | Rate hikes begin | 2022 bear |
| 2022-06 → 2025-12-01 | QT2 | Ended early (Oct 2025 FOMC decision) |
| 2024-09 | First rate cut of cycle | — |
| 2025-12 | RMP starts (~$40B/month T-bills) | — |
| 2026 | RMP tapered $40B → $10B, then paused (TD Securities, Aug 2026). Not confirmed by official Fed statement | — |

---

## 3. US politics cycle

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 3.1 | **Presidential elections** | Nov 2012, 2016, 2020, 2024. Each ~6–7 months after a halving | L | B (only 4 data points; overlaps halving) | EVENT | Calendar |
| 3.2 | **Midterm elections** | Nov 2014, 2018, 2022 — all near bear-market bottoms | L | B (3 data points) | EVENT | Calendar |
| 3.3 | **Presidential cycle theory** | Stock market: year 3 strongest, midterm year weakest | L | B for stocks, C for BTC | ZONE | Stock Trader's Almanac |
| 3.4 | **Policy / regulation events** | ETF approvals, SEC actions, laws (e.g. GENIUS Act stablecoin law, Jul 2025), US Strategic Bitcoin Reserve order (Mar 2025) | S–M | B | EVENT | News |
| 3.5 | **Debt ceiling / gov shutdown** | Moves TGA, so moves liquidity | S–M | B | ZONE | News / FRED |

Upcoming dates: **Midterm 2026-11-03.** **Presidential 2028-11-07.**

---

## 4. Business cycle and macro data

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 4.1 | **ISM Manufacturing PMI** | Above 50 = economy expanding. BTC tops have lined up with ISM peaks (Raoul Pal thesis) | M–L | B | PANE | ISM / TradingView ECONOMICS |
| 4.2 | **Recessions** | NBER recession periods | L | B | ZONE | FRED `USREC` |
| 4.3 | **Yield curve (10Y−2Y)** | Inversion warns of recession | L | B | PANE | FRED `T10Y2Y` |
| 4.4 | **Real yields (10Y TIPS)** | Higher real yield = bad for BTC, gold | M | A– | PANE | FRED `DFII10` |
| 4.5 | **US Dollar Index (DXY)** | Strong dollar usually = weak BTC (inverse) | S–M | A | OVERLAY | TradingView DXY / FRED `DTWEXBGS` |
| 4.6 | **CPI / PCE inflation** | Data-release days move price fast | S | B | EVENT | BLS / BEA |
| 4.7 | **Jobs report (NFP)** | First Friday each month | S | B | EVENT | BLS |
| 4.8 | **FOMC meetings** | 8 per year. Big volatility on decision day | S | A | EVENT | federalreserve.gov |
| 4.9 | **Stocks (Nasdaq / S&P 500)** | BTC trades like a tech stock, correlation changes over time | S–M | A | OVERLAY | Index data |
| 4.10 | **Gold** | Sometimes leads BTC ("digital gold" thesis) | M | B | OVERLAY | Gold price |
| 4.11 | **Credit spreads (high yield)** | Risk appetite | M | B | PANE | FRED `BAMLH0A0HYM2` |
| 4.12 | **Volatility index (VIX / MOVE)** | Fear in stocks / bonds | S | B | PANE | CBOE / ICE |

---

## 5. Miners and hash power

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 5.1 | **Hash rate** | Total mining power. Follows price, lags it | L | B (lagging) | PANE | mempool.space / blockchain.com |
| 5.2 | **Mining difficulty** | Adjusts every 2,016 blocks (~2 weeks) | L | B | PANE | mempool.space |
| 5.3 | **Hash Ribbons** | 30-day vs 60-day hash rate MA. Cross = miner capitulation ended (buy signal, Charles Edwards) | M | A– | PANE | Calc from hash rate |
| 5.4 | **Puell Multiple** | Miner daily revenue ÷ 365-day average. Low = bottom zone, high = top zone | M–L | B | PANE | Bitcoin Magazine Pro / Glassnode |
| 5.5 | **Hashprice** | Miner revenue per unit of hash | M | B | PANE | Hashrate Index (Luxor) |
| 5.6 | **Miner reserves / outflows** | Miners selling coins | S–M | B | PANE | CryptoQuant |
| 5.7 | **Cost of production** | Est. cost to mine 1 BTC (price floor theory) | L | B | OVERLAY | Various models |
| 5.8 | **Big hash shocks** | e.g. China mining ban May–Jun 2021 (~50% hash drop) | M | B | EVENT | News |

---

## 6. On-chain valuation (cycle top / bottom tools)

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 6.1 | **Realized Price** | Average price all coins last moved at | L | A | OVERLAY | Glassnode |
| 6.2 | **MVRV ratio** | Market value ÷ realized value | L | A | PANE | Glassnode |
| 6.3 | **MVRV Z-Score** | MVRV adjusted for volatility. >7 top, <0 bottom (history) | L | A– (did not fire at 2025 top) | PANE | Bitcoin Magazine Pro |
| 6.4 | **NUPL** | Net unrealized profit/loss of all holders | L | A– | PANE | Glassnode |
| 6.5 | **STH / LTH Realized Price** | Cost basis of short-term vs long-term holders | M–L | A | OVERLAY | Glassnode |
| 6.6 | **SOPR / aSOPR** | Are coins being sold at profit or loss | S–M | B | PANE | Glassnode |
| 6.7 | **Long-term holder supply** | LTHs selling into rallies = top phase | L | A– | PANE | Glassnode |
| 6.8 | **HODL Waves / RHODL Ratio** | Age of coins | L | B | PANE | Glassnode |
| 6.9 | **Reserve Risk** | Holder confidence vs price | L | B | PANE | Bitcoin Magazine Pro |
| 6.10 | **Coin Days Destroyed / Dormancy** | Old coins moving | M | B | PANE | Glassnode |
| 6.11 | **NVT ratio** | Market cap ÷ transaction volume ("P/E for BTC") | M | C | PANE | On-chain |
| 6.12 | **Active addresses / tx count** | Network use | M–L | B | PANE | On-chain |
| 6.13 | **Whale holdings** | Wallets 1k+ BTC accumulating / selling | M | B | PANE | Glassnode / Santiment |
| 6.14 | **Stablecoin supply** | USDT + USDC market cap = "dry powder" | M | A– | PANE | DefiLlama |
| 6.15 | **Stablecoin Supply Ratio (SSR)** | BTC cap ÷ stablecoin cap | M | B | PANE | Glassnode |

---

## 7. Price-model tools (from price only)

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 7.1 | **200-Week Moving Average** | Historic bear-market floor | L | A | OVERLAY | Price |
| 7.2 | **Pi Cycle Top** | 111DMA crosses 2×350DMA = top | L | B (hit 2013, 2017, 2021; no signal 2025) | OVERLAY | Price |
| 7.3 | **2-Year MA Multiplier** | 2Y MA and 5× 2Y MA bands | L | B | OVERLAY | Price |
| 7.4 | **Golden Ratio Multiplier** | 350DMA × Fibonacci multiples | L | B | OVERLAY | Price |
| 7.5 | **Mayer Multiple** | Price ÷ 200DMA | M–L | B | PANE | Price |
| 7.6 | **Bull Market Support Band** | 20W SMA + 21W EMA | M | A– | OVERLAY | Price |
| 7.7 | **50 / 200 DMA crosses** | Golden cross / death cross | M | B | OVERLAY | Price |
| 7.8 | **Power Law model** | Price vs time on log-log chart | L | B | OVERLAY | Price |
| 7.9 | **Log growth / Rainbow Chart** | Log regression bands | L | C (meme, but watched) | OVERLAY | Price |
| 7.10 | **Monthly / weekly RSI** | Overbought / oversold on high timeframe | M–L | B | PANE | Price |
| 7.11 | **Realized volatility** | Low vol often comes before big moves | S–M | B | PANE | Price |

---

## 8. Market flows and big buyers / sellers

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 8.1 | **Spot ETF net flows** | US spot ETFs launched 2024-01-11. Record $5.2B outflow H1 2026 (reported) | S–M | A | PANE | Farside Investors |
| 8.2 | **ETF total holdings** | BTC held by all ETFs | M–L | A | PANE | Farside / issuer sites |
| 8.3 | **Corporate treasuries** | Strategy (MicroStrategy) and others buying | M | B | EVENT | Company filings |
| 8.4 | **Government sales / reserves** | e.g. German gov sale Jul 2024, Mt. Gox payouts 2024, US Strategic Bitcoin Reserve Mar 2025 | S–M | B | EVENT | Arkham / news |
| 8.5 | **Coinbase Premium** | US buyers vs offshore buyers | S | B | PANE | CryptoQuant |
| 8.6 | **Kimchi Premium** | Korea retail mania | S | C | PANE | CryptoQuant |
| 8.7 | **Exchange netflows** | Coins moving onto exchanges (to sell) or off (to hold) | S | B | PANE | CryptoQuant |

---

## 9. Derivatives and leverage

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 9.1 | **Funding rates** | High positive = crowded longs | S | A | PANE | Coinglass |
| 9.2 | **Open interest** | Total leverage in market | S | A | PANE | Coinglass |
| 9.3 | **Estimated leverage ratio** | OI ÷ exchange reserves | S–M | B | PANE | CryptoQuant |
| 9.4 | **Liquidation levels / heatmap** | Price levels where many positions get wiped | S | A– | OVERLAY | Coinglass / Kiyotaka |
| 9.5 | **Liquidation events** | e.g. 2025-10-10 (largest liquidation day on record, ~$19B reported) | S | B | EVENT | Coinglass |
| 9.6 | **Options expiry** | Deribit monthly / quarterly expiry, last Friday 08:00 UTC | S | B | EVENT | Deribit |
| 9.7 | **Options max pain / put-call skew** | Where options sellers profit most / fear of downside | S | C–B | OVERLAY | Deribit / Laevitas |
| 9.8 | **Implied volatility (DVOL)** | Expected volatility | S | B | PANE | Deribit |
| 9.9 | **CME futures gaps** | Weekend price gaps on CME chart. Folklore says they "fill" | S | C | ZONE | CME chart |
| 9.10 | **Futures basis** | Futures premium over spot. High = euphoria | S–M | B | PANE | CME / Laevitas |

---

## 10. Sentiment

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 10.1 | **Fear & Greed Index** | Mix of vol, momentum, social, etc. | S–M | B (contrarian) | PANE | alternative.me |
| 10.2 | **Google Trends "bitcoin"** | Retail interest. Peaks at tops | M | B | PANE | Google Trends |
| 10.3 | **App store rank (Coinbase)** | Retail rush | M | B | PANE | App store trackers |
| 10.4 | **Social volume / sentiment** | X / Reddit / YouTube mentions | S | C–B | PANE | Santiment / LunarCrush |
| 10.5 | **Prediction market odds** | Polymarket / Kalshi BTC price markets | S–M | B | PANE | Polymarket / Kalshi |

---

## 11. Crypto market structure

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 11.1 | **BTC Dominance** | BTC share of total crypto cap | M | A | PANE | TradingView `BTC.D` |
| 11.2 | **ETH/BTC ratio** | Altcoin risk appetite | M | B | PANE | Price |
| 11.3 | **Altcoin Season Index** | Alts beating BTC = late cycle | M | B | PANE | blockchaincenter.net |
| 11.4 | **Total crypto market cap** | Whole market trend | M–L | A | OVERLAY | TradingView `TOTAL` |
| 11.5 | **Black swan events** | Mt. Gox (2014), COVID crash (2020-03-12), China ban (2021), FTX (2022-11), etc. | S–M | — | EVENT | News |

---

## 12. Time / seasonality

| # | Item | What it measures | Horizon | Evidence | Chart | Data source |
|---|---|---|---|---|---|---|
| 12.1 | **Month-of-year returns** | Oct/Nov strong, Sep weak (historic averages) | M | C–B (small sample) | ZONE | Price history |
| 12.2 | **Day-of-week / weekend** | Weekends = thin liquidity, fake moves | S | B | ZONE | Price history |
| 12.3 | **Trading sessions** | Asia / London / New York open | S | B | ZONE | Clock |
| 12.4 | **Quarter-end / year-end** | Fund rebalancing, window dressing | S | C | EVENT | Calendar |
| 12.5 | **US tax season** | Selling to pay taxes (April) | S | C | ZONE | Calendar |
| 12.6 | **Holidays** | Low volume periods | S | C | ZONE | Calendar |

---

## 13. Long-wave economic cycles (big picture)

All weak for BTC. BTC is only ~17 years old. These are stock / economy theories.

| # | Item | Length | Evidence for BTC | Chart |
|---|---|---|---|---|
| 13.1 | **Kitchin cycle** (inventory) | ~3–4 years. Some link it to the 4-year cycle | C | ZONE |
| 13.2 | **Juglar cycle** (business investment) | ~7–11 years | C | ZONE |
| 13.3 | **Kuznets cycle** (real estate / infrastructure) | ~15–25 years | C | ZONE |
| 13.4 | **Kondratiev wave** (tech / debt super-cycle) | ~40–60 years | C | ZONE |
| 13.5 | **Benner Cycle** (1875 "panic / good / hard times" chart) | ~8–11–16 yr pattern | C (folklore) | EVENT |
| 13.6 | **Dalio debt cycle** | Short ~5–10y, long ~50–75y | C | ZONE |
| 13.7 | **Lunar cycles** | Full / new moon | C (fringe, no solid proof) | EVENT |

---

## Top 12 if you only chart a few

Ranked by how much the market actually watches them:

1. Halving dates + days since halving (1.1, 1.3)
2. Global M2 / Fed Net Liquidity (2.6, 2.2)
3. Fed funds rate + QE/QT zones (2.7, 2.1)
4. DXY (4.5)
5. ISM PMI (4.1)
6. MVRV Z-Score (6.3)
7. 200-Week MA + Realized Price (7.1, 6.1)
8. STH Realized Price (6.5)
9. Spot ETF flows (8.1)
10. Funding + Open Interest (9.1, 9.2)
11. Hash Ribbons / Puell (5.3, 5.4)
12. Election + midterm dates (3.1, 3.2)

---

## Honest warnings

- Few data points. BTC has had only 4 halvings and 4 full cycles. Patterns can break.
- Many items move together because of one driver: global liquidity. Stacking them can double-count.
- 2024–2026 cycle behaved differently (ETFs, institutions, no Pi Cycle signal at top).
- Paid data: much on-chain data (Glassnode, CryptoQuant) needs a paid API. FRED and price data are free.

## Sources checked for this list (2026-10-25)

- [Yahoo Finance — Bitcoin 4-year cycle](https://finance.yahoo.com/markets/crypto/articles/bitcoin-4-cycle-says-btc-174705346.html)
- [CoinSwitch — Bitcoin all-time high](https://coinswitch.co/switch/crypto/bitcoin-all-time-high/)
- [FutureSearch — next BTC ATH (Aug 2026 price data)](https://futuresearch.ai/app/p/a/when-will-bitcoin-btc-next-reach-a-new-all-time)
- [IDN Financials — Fed ends QT early](https://www.idnfinancials.com/news/58921/the-fed-is-accelerating-the-end-of-quantitative-tightening-why)
- [FXStreet — TD Securities on RMP pause (Aug 2026)](https://www.fxstreet.com/news/federal-reserve-rmp-pause-and-qt-timing-td-securities-202608140908)
- [Advisor Perspectives — Fed T-bill purchases down (Apr 2026)](https://www.advisorperspectives.com/articles/2026/04/13/wall-street-cautious-fed-t-bill-purchases-down)
- [Spark — cycle indicator comparison (Jul 2026 values)](https://www.spark.money/tools/bitcoin-market-cycle-indicator-comparison)
- [Cointelegraph — 5 cycle-top indicators](https://cointelegraph.com/news/is-bitcoin-price-close-to-a-cycle-top-5-indicators-that-help-traders-decide)
- [21Shares — Have we reached this cycle's peak?](https://www.21shares.com/en-eu/research/newsletter-issue-256)

Older dates (halvings, past peaks/bottoms, QT1, QE4, FTX, China ban) are from well-known public records, not re-searched today.
