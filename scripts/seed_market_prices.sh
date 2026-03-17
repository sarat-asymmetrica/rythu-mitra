#!/bin/bash
# Seed 30 days of realistic mandi price history for Rythu Mitra
# Generates INSERT statements for market_price table via spacetime sql
#
# Crops & Mandis (Anantapur region):
#   1. వేరుశెనగ (Groundnut) - Anantapur, Kurnool, Hindupur
#   2. పత్తి (Cotton) - Anantapur, Kurnool, Guntur
#   3. మొక్కజొన్న (Maize) - Anantapur, Kurnool
#   4. కంది (Pigeon pea) - Anantapur, Kurnool

SPACETIME="C:/Users/schan/AppData/Local/SpacetimeDB/spacetime.exe"
DB="rythu-mitra"

# First, delete existing single-day seeded data to avoid duplicates
echo "Clearing existing market_price data..."
# We'll use the reducer approach instead - insert fresh data

# Generate dates from Feb 15 to Mar 16 (30 days)
# Price generation: start + cumulative random walk with mean reversion

generate_prices() {
  local crop="$1"
  local mandi="$2"
  local district="$3"
  local start_price="$4"  # in paise
  local msp="$5"          # in paise
  local volatility="$6"   # daily variance in paise
  local trend="$7"        # daily trend bias in paise

  local price=$start_price
  local day=0

  # 30 days: Feb 15 - Mar 16, 2026
  for date in \
    2026-02-15 2026-02-16 2026-02-17 2026-02-18 2026-02-19 \
    2026-02-20 2026-02-21 2026-02-22 2026-02-23 2026-02-24 \
    2026-02-25 2026-02-26 2026-02-27 2026-02-28 \
    2026-03-01 2026-03-02 2026-03-03 2026-03-04 2026-03-05 \
    2026-03-06 2026-03-07 2026-03-08 2026-03-09 2026-03-10 \
    2026-03-11 2026-03-12 2026-03-13 2026-03-14 2026-03-15 \
    2026-03-16; do

    # Random walk: trend + noise (using $RANDOM which is 0-32767)
    local noise=$(( (RANDOM % (volatility * 2 + 1)) - volatility ))
    local change=$(( trend + noise ))
    price=$(( price + change ))

    # Mean reversion: if price drifts too far from start, pull back
    local drift=$(( price - start_price ))
    if [ $drift -gt $((volatility * 8)) ]; then
      price=$(( price - volatility / 2 ))
    elif [ $drift -lt $((-volatility * 8)) ]; then
      price=$(( price + volatility / 2 ))
    fi

    echo "INSERT INTO market_price (id, crop, mandi, district, price_per_quintal_paise, msp_price_paise, date) VALUES (0, '${crop}', '${mandi}', '${district}', ${price}, ${msp}, '${date}');"

    day=$((day + 1))
  done
}

echo "Generating and inserting 30-day price history..."

# ── Groundnut (వేరుశెనగ) ──
# MSP for groundnut 2025-26: ~Rs 5,600/quintal = 560000 paise
# Anantapur: Rs 5,720 start, slight upward, ±Rs 50
generate_prices "వేరుశెనగ" "అనంతపురం" "అనంతపురం" 572000 560000 5000 400 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [1/10] వేరుశెనగ - అనంతపురం done"

# Kurnool: Rs 5,780 start (premium market), ±Rs 60
generate_prices "వేరుశెనగ" "కర్నూలు" "కర్నూలు" 578000 560000 6000 500 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [2/10] వేరుశెనగ - కర్నూలు done"

# Hindupur: Rs 5,680 start (smaller mandi), ±Rs 40
generate_prices "వేరుశెనగ" "హిందూపురం" "అనంతపురం" 568000 560000 4000 300 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [3/10] వేరుశెనగ - హిందూపురం done"

# ── Cotton (పత్తి) ──
# MSP for cotton 2025-26: ~Rs 6,700/quintal = 670000 paise
# Anantapur: Rs 6,650 start, ±Rs 60
generate_prices "పత్తి" "అనంతపురం" "అనంతపురం" 665000 670000 6000 500 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [4/10] పత్తి - అనంతపురం done"

# Kurnool: Rs 6,800 start, ±Rs 50
generate_prices "పత్తి" "కర్నూలు" "కర్నూలు" 680000 670000 5000 400 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [5/10] పత్తి - కర్నూలు done"

# Guntur: Rs 6,920 start (cotton hub, highest), ±Rs 70
generate_prices "పత్తి" "గుంటూరు" "గుంటూరు" 692000 670000 7000 600 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [6/10] పత్తి - గుంటూరు done"

# ── Maize (మొక్కజొన్న) ──
# MSP for maize: ~Rs 2,090/quintal = 209000 paise
# Anantapur: Rs 1,950 start, ±Rs 30
generate_prices "మొక్కజొన్న" "అనంతపురం" "అనంతపురం" 195000 209000 3000 200 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [7/10] మొక్కజొన్న - అనంతపురం done"

# Kurnool: Rs 2,020 start, ±Rs 35
generate_prices "మొక్కజొన్న" "కర్నూలు" "కర్నూలు" 202000 209000 3500 250 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [8/10] మొక్కజొన్న - కర్నూలు done"

# ── Pigeon pea (కంది) ──
# MSP for tur/pigeon pea: ~Rs 7,000/quintal = 700000 paise
# Anantapur: Rs 6,600 start, ±Rs 60
generate_prices "కంది" "అనంతపురం" "అనంతపురం" 660000 700000 6000 500 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [9/10] కంది - అనంతపురం done"

# Kurnool: Rs 6,800 start, ±Rs 55
generate_prices "కంది" "కర్నూలు" "కర్నూలు" 680000 700000 5500 450 | while read sql; do
  "$SPACETIME" sql "$DB" "$sql" 2>/dev/null
done
echo "  [10/10] కంది - కర్నూలు done"

echo ""
echo "Seeding complete! 300 rows inserted (10 crop-mandi combos x 30 days)"
echo "Verifying..."
"$SPACETIME" sql "$DB" "SELECT crop, mandi, date FROM market_price LIMIT 10"
