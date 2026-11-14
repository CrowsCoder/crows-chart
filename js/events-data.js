// Hand-curated dates. Every date here is a well-known public record.
// Items marked `approx: true` have a fuzzy start or end. Keep notes short.

export const HALVINGS = [
  { d: '2012-11-28', label: 'Halving 1', note: 'Block 210,000. Reward 50 → 25 BTC.' },
  { d: '2016-07-09', label: 'Halving 2', note: 'Block 420,000. Reward 25 → 12.5 BTC.' },
  { d: '2020-05-11', label: 'Halving 3', note: 'Block 630,000. Reward 12.5 → 6.25 BTC.' },
  { d: '2024-04-20', label: 'Halving 4', note: 'Block 840,000. Reward 6.25 → 3.125 BTC.' },
  { d: '2028-04-15', label: 'Halving 5 (est.)', note: 'Block 1,050,000. Date is an estimate.', approx: true },
];

// Search windows; the app finds the exact high/low inside each from the data.
export const CYCLE_PEAK_WINDOWS = [
  ['2011-05-15', '2011-07-15', '2011 peak'],
  ['2013-11-01', '2013-12-31', '2013 cycle top'],
  ['2017-12-01', '2018-01-10', '2017 cycle top'],
  ['2021-10-15', '2021-11-30', '2021 cycle top'],
  ['2025-09-15', '2025-11-01', '2025 cycle top'],
];
export const CYCLE_BOTTOM_WINDOWS = [
  ['2011-10-01', '2011-12-31', '2011 bottom'],
  ['2014-12-01', '2015-02-28', '2015 cycle bottom'],
  ['2018-11-15', '2019-02-15', '2018 cycle bottom'],
  ['2022-06-01', '2022-12-31', '2022 cycle bottom'],
  ['2026-01-15', '2026-09-30', '2026 low so far (not confirmed final)'],
];

export const QE_ZONES = [
  { from: '2008-11-25', to: '2010-03-31', label: 'QE1' },
  { from: '2010-11-03', to: '2011-06-30', label: 'QE2' },
  { from: '2011-09-21', to: '2012-12-31', label: 'Operation Twist', note: 'Swapped short bonds for long. Balance sheet flat.' },
  { from: '2012-09-13', to: '2014-10-29', label: 'QE3' },
  { from: '2019-10-11', to: '2020-03-14', label: '"Not-QE" (T-bill buys)', note: 'Fed bought T-bills after the Sep 2019 repo spike. Fed said it was not QE.' },
  { from: '2020-03-15', to: '2022-03-09', label: 'QE4 (COVID)' },
  { from: '2025-12-12', to: '2026-08-13', label: 'RMP (reserve mgmt purchases)', note: 'T-bill buys: ~$40B/mo, cut to $25B (Apr 2026), $10B (May), zero from 2026-08-13. Paused, not formally ended. Sources: Bloomberg Law, The Star.', approx: true },
];
export const QT_ZONES = [
  { from: '2017-10-01', to: '2019-07-31', label: 'QT1' },
  { from: '2022-06-01', to: '2025-12-01', label: 'QT2', note: 'Fed ended QT early on 2025-12-01.' },
];
export const TAPER_ZONES = [
  { from: '2013-12-18', to: '2014-10-29', label: 'QE3 taper (announced)' },
  { from: '2021-11-03', to: '2022-03-09', label: 'QE4 taper (announced)' },
];

export const PRESIDENTIAL = [
  { d: '2012-11-06', label: 'Presidential election 2012', note: 'Obama re-elected.' },
  { d: '2016-11-08', label: 'Presidential election 2016', note: 'Trump elected.' },
  { d: '2020-11-03', label: 'Presidential election 2020', note: 'Biden elected.' },
  { d: '2024-11-05', label: 'Presidential election 2024', note: 'Trump elected.' },
  { d: '2028-11-07', label: 'Presidential election 2028', note: 'Future.' },
];
export const MIDTERMS = [
  { d: '2010-11-02', label: 'Midterm 2010', note: 'GOP won the House.' },
  { d: '2014-11-04', label: 'Midterm 2014', note: 'GOP won the Senate.' },
  { d: '2018-11-06', label: 'Midterm 2018', note: 'Democrats won the House.' },
  { d: '2022-11-08', label: 'Midterm 2022', note: 'GOP won the House (narrow).' },
  { d: '2026-11-03', label: 'Midterm 2026', note: 'Upcoming.' },
];
export const INAUGURATIONS = ['2013-01-20', '2017-01-20', '2021-01-20', '2025-01-20', '2029-01-20']
  .map((d) => ({ d, label: `Inauguration ${d.slice(0, 4)}` }));

export const SHUTDOWNS = [
  { from: '2013-10-01', to: '2013-10-17', label: 'Gov shutdown 2013 (16 days)' },
  { from: '2018-01-20', to: '2018-01-23', label: 'Gov shutdown Jan 2018 (3 days)' },
  { from: '2018-12-22', to: '2019-01-25', label: 'Gov shutdown 2018–19 (35 days)' },
  { from: '2025-10-01', to: '2025-11-12', label: 'Gov shutdown 2025 (43 days, longest full)' },
  { from: '2026-01-31', to: '2026-02-03', label: 'Partial shutdown Jan 2026 (4 days)', note: 'Source: Wikipedia 2026 shutdowns page.' },
  { from: '2026-02-14', to: '2026-04-30', label: 'DHS-only shutdown 2026 (76 days)', note: 'Single source (Wikipedia). Medium confidence.', approx: true },
];
export const CREDIT_DOWNGRADES = [
  { d: '2011-08-05', label: 'S&P downgrades US (AAA → AA+)', note: 'After the 2011 debt-ceiling fight.' },
  { d: '2023-06-03', label: 'Debt ceiling deal signed', note: 'Fiscal Responsibility Act.' },
  { d: '2023-08-01', label: 'Fitch downgrades US' },
  { d: '2025-05-16', label: "Moody's downgrades US" },
];

export const POLICY_EVENTS = [
  { d: '2013-12-05', label: 'China central bank bars banks from BTC' },
  { d: '2017-09-04', label: 'China bans ICOs', note: 'Chinese exchanges shut down weeks later.' },
  { d: '2017-12-10', label: 'CBOE BTC futures launch' },
  { d: '2017-12-17', label: 'CME BTC futures launch' },
  { d: '2021-05-21', label: 'China State Council mining crackdown' },
  { d: '2021-09-07', label: 'El Salvador: BTC legal tender' },
  { d: '2021-09-24', label: 'China bans all crypto transactions' },
  { d: '2021-10-19', label: 'First US BTC futures ETF (BITO)' },
  { d: '2023-06-05', label: 'SEC sues Binance (Coinbase next day)' },
  { d: '2023-06-15', label: 'BlackRock files spot BTC ETF' },
  { d: '2023-08-29', label: 'Grayscale wins vs SEC in court' },
  { d: '2024-01-10', label: 'SEC approves spot BTC ETFs', note: 'Trading started 2024-01-11.' },
  { d: '2025-03-06', label: 'US Strategic Bitcoin Reserve order' },
  { d: '2025-07-18', label: 'GENIUS Act signed (stablecoins)' },
];

export const CRYPTO_EVENTS = [
  { d: '2011-06-19', label: 'Mt. Gox hack' },
  { d: '2013-10-02', label: 'Silk Road shut down by FBI' },
  { d: '2014-02-07', label: 'Mt. Gox halts withdrawals' },
  { d: '2014-02-28', label: 'Mt. Gox files bankruptcy' },
  { d: '2016-08-02', label: 'Bitfinex hack' },
  { d: '2017-08-01', label: 'Bitcoin Cash fork' },
  { d: '2017-08-24', label: 'SegWit activates' },
  { d: '2018-01-26', label: 'Coincheck hack' },
  { d: '2018-11-15', label: 'Bitcoin Cash hash war crash' },
  { d: '2020-03-12', label: 'COVID crash ("Black Thursday")' },
  { d: '2020-08-11', label: 'MicroStrategy first BTC buy' },
  { d: '2020-10-21', label: 'PayPal adds crypto' },
  { d: '2021-02-08', label: 'Tesla buys $1.5B BTC' },
  { d: '2021-04-14', label: 'Coinbase goes public' },
  { d: '2021-05-12', label: 'Tesla stops BTC payments' },
  { d: '2021-05-19', label: 'May 19 leverage crash' },
  { d: '2021-11-14', label: 'Taproot activates' },
  { d: '2022-05-09', label: 'Terra/LUNA collapse' },
  { d: '2022-06-12', label: 'Celsius freezes withdrawals' },
  { d: '2022-06-27', label: '3AC ordered into liquidation' },
  { d: '2022-11-08', label: 'FTX halts withdrawals', note: 'Filed bankruptcy 2022-11-11.' },
  { d: '2022-11-11', label: 'FTX bankruptcy' },
  { d: '2023-11-21', label: 'Binance / CZ plead guilty ($4.3B)' },
  { d: '2024-07-05', label: 'Mt. Gox repayments begin' },
  { d: '2025-02-21', label: 'Bybit hack (~$1.5B)' },
  { d: '2025-10-10', label: 'Record liquidation day (~$19B)', note: 'After US 100% China tariff threat.' },
  { d: '2026-02-05', label: 'Feb 2026 crash (BTC < $60k next day)', note: 'Bitstamp low $59,930 on 2026-02-06.' },
];
export const SUPPLY_SHOCK_ZONES = [
  { from: '2024-06-19', to: '2024-07-12', label: 'German government BTC sales', approx: true },
];

export const WAR_ZONES = [
  { from: '2014-02-27', to: '2014-03-18', label: 'Russia annexes Crimea' },
  { from: '2018-07-06', to: '2020-01-15', label: 'US–China trade war (to Phase One deal)' },
  { from: '2022-02-24', to: null, label: 'Russia–Ukraine war', note: 'Still ongoing as of Oct 2026 (no ceasefire in force).' },
  { from: '2023-10-07', to: '2025-10-10', label: 'Israel–Hamas war', note: 'Ends at the 2025-10-10 ceasefire. Strikes continue at lower intensity in 2026 (Al Jazeera).', approx: true },
  { from: '2026-02-28', to: null, label: '2026 Iran war (US + Israel)', note: 'Ceasefire 2026-04-08, collapsed 2026-07-08. Still active Oct 2026. Source: Wikipedia, Al Jazeera.' },
  { from: '2025-05-07', to: '2025-05-10', label: 'India–Pakistan conflict' },
  { from: '2025-06-13', to: '2025-06-24', label: 'Israel–Iran 12-day war' },
];
export const WAR_EVENTS = [
  { d: '2020-01-03', label: 'US kills Soleimani (Iran)' },
  { d: '2021-08-15', label: 'Taliban take Kabul' },
  { d: '2021-08-30', label: 'US leaves Afghanistan (war ends)' },
  { d: '2022-02-24', label: 'Russia invades Ukraine' },
  { d: '2023-10-07', label: 'Hamas attacks Israel' },
  { d: '2024-04-13', label: 'Iran attacks Israel (drones)' },
  { d: '2024-10-01', label: 'Iran missile attack on Israel' },
  { d: '2024-12-08', label: 'Assad regime falls (Syria)' },
  { d: '2025-04-02', label: '"Liberation Day" tariffs' },
  { d: '2025-04-09', label: '90-day tariff pause' },
  { d: '2025-06-22', label: 'US strikes Iran nuclear sites' },
  { d: '2026-01-03', label: 'US captures Maduro (Venezuela)', note: 'Source: OPB.' },
  { d: '2026-02-20', label: 'Supreme Court strikes down IEEPA tariffs', note: 'Source: Thomson Reuters.' },
  { d: '2026-02-28', label: 'US + Israel attack Iran', note: 'Oil spiked ~35% that week. Source: Wikipedia.' },
  { d: '2026-04-08', label: 'Iran ceasefire', note: 'Brent −13% in a day.' },
  { d: '2026-07-08', label: 'Iran ceasefire collapses' },
  { d: '2026-10-11', label: 'Russia–Ukraine "energy ceasefire" announced', note: 'Not holding per Ukraine. Source: Ukrainska Pravda.' },
];

export const FED_CHAIRS = [
  { d: '2014-02-03', label: 'Yellen becomes Fed chair' },
  { d: '2018-02-05', label: 'Powell becomes Fed chair' },
  { d: '2026-01-30', label: 'Warsh named Fed chair pick', note: 'Gold −9%, silver −28% that day. Source: Cointelegraph, Decrypt.' },
  { d: '2026-05-22', label: 'Warsh sworn in as Fed chair', note: 'Source: CBS / WDEF.' },
];

export const MACRO_SHOCKS = [
  { d: '2013-03-16', label: 'Cyprus bank bail-in' },
  { d: '2015-06-29', label: 'Greece capital controls' },
  { d: '2015-08-11', label: 'China devalues yuan' },
  { d: '2016-06-23', label: 'Brexit vote' },
  { d: '2020-03-11', label: 'WHO declares COVID pandemic' },
  { d: '2020-03-27', label: 'CARES Act stimulus ($2.2T)' },
  { d: '2023-03-10', label: 'Silicon Valley Bank fails' },
  { d: '2023-03-12', label: 'Fed launches BTFP bailout' },
  { d: '2024-08-05', label: 'Yen carry-trade crash' },
];

// Benner cycle card (1875). Folklore. Shown for curiosity only.
export const BENNER = {
  panic: [1999, 2019, 2035],
  goodSell: [2007, 2016, 2026, 2034],
  hardBuy: [2005, 2012, 2023, 2032],
};
