#!/usr/bin/env python3
"""
Generate synthetic credit bureau, LexisNexis, internal, and performance data
from the data dictionaries. Produces per-portfolio CSV files that an AI agent
can use to explore attributes, distributions, and model diagnostics.
"""

import json
import os
import csv
import random
import math
from pathlib import Path

DICT_DIR = Path(__file__).resolve().parent.parent / "dictionaries"
OUT_DIR = Path(__file__).resolve().parent.parent / "generated"
RECORDS_PER_PORTFOLIO = 5000
RANDOM_SEED = 42

PORTFOLIOS = ["auto_loan", "credit_card", "mortgage", "personal_loan"]
DICT_FILES = ["experian.json", "equifax.json", "transunion.json", "lexisnexis.json", "internal.json", "performance.json"]


def load_dictionaries():
    dicts = []
    for fname in DICT_FILES:
        fpath = DICT_DIR / fname
        with open(fpath) as f:
            dicts.append(json.load(f))
    return dicts


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def generate_value(attr, portfolio, rng, target_val=None):
    stats = attr.get("typical_stats", {}).get(portfolio)
    if not stats:
        return None

    mean = stats.get("mean")
    std = stats.get("std", 0)
    vmin = stats.get("min")
    vmax = stats.get("max")

    if mean is None or mean == -1:
        return -1

    dtype = attr.get("data_type", "float")
    sv = attr.get("special_values", {})
    valid = attr.get("valid_range", [None, None])

    # ~3% chance of returning a special missing value
    if rng.random() < 0.03:
        neg_keys = [k for k in sv if k.startswith("-")]
        if neg_keys:
            return int(rng.choice(neg_keys))

    if dtype == "binary":
        return 1 if rng.random() < mean else 0

    if dtype == "categorical":
        if vmax is not None and vmin is not None and vmax > vmin:
            val = rng.gauss(mean, std) if std > 0 else mean
            val = int(round(clamp(val, vmin, vmax)))
            return val
        return int(round(mean))

    if dtype == "date":
        if vmin and vmax and vmin > 19000000:
            y1, y2 = vmin // 10000, vmax // 10000
            yr = rng.randint(y1, y2)
            mo = rng.randint(1, 12)
            dy = rng.randint(1, 28)
            return yr * 10000 + mo * 100 + dy
        return None

    # For scores and delinquency counts where correlation to target matters,
    # shift mean based on target to create realistic separation
    adj_mean = mean
    if target_val is not None and attr.get("segment") in ("score", "alternative_score"):
        importance = stats.get("importance", 0.1)
        shift = std * importance * 3.0
        adj_mean = mean + shift if target_val == 0 else mean - shift
    elif target_val is not None and attr.get("segment") == "delinquency":
        importance = stats.get("importance", 0.1)
        shift = std * importance * 2.5
        adj_mean = mean - shift * 0.5 if target_val == 0 else mean + shift * 1.5

    if std > 0:
        val = rng.gauss(adj_mean, std)
    else:
        val = adj_mean

    lo = valid[0] if valid[0] is not None else vmin
    hi = valid[1] if valid[1] is not None else vmax
    if lo is not None and hi is not None:
        val = clamp(val, lo, hi)

    if dtype in ("integer", "ordinal"):
        val = int(round(val))
    else:
        val = round(val, 2)

    return val


def generate_portfolio_data(dicts, portfolio, rng):
    perf_dict = None
    feature_dicts = []
    for d in dicts:
        if d["source"] == "Internal_Performance":
            perf_dict = d
        else:
            feature_dicts.append(d)

    target_attr = None
    perf_attrs = []
    if perf_dict:
        for a in perf_dict["attributes"]:
            if a["name"] == "PERF_TARGET_90DPD_24M":
                target_attr = a
            else:
                perf_attrs.append(a)

    rows = []
    for i in range(RECORDS_PER_PORTFOLIO):
        record = {"ACCOUNT_ID": f"{portfolio[:2].upper()}{i+1:07d}"}

        # generate target first so features can correlate
        target_val = None
        if target_attr:
            target_val = generate_value(target_attr, portfolio, rng)
            record[target_attr["name"]] = target_val

        for d in feature_dicts:
            for attr in d["attributes"]:
                val = generate_value(attr, portfolio, rng, target_val)
                if val is not None:
                    record[attr["name"]] = val

        for attr in perf_attrs:
            val = generate_value(attr, portfolio, rng, target_val)
            if val is not None:
                record[attr["name"]] = val

        rows.append(record)

    return rows


def write_csv(rows, filepath):
    if not rows:
        return
    keys = list(rows[0].keys())
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def build_combined_dictionary(dicts):
    combined = []
    for d in dicts:
        source = d["source"]
        for attr in d["attributes"]:
            entry = {
                "source": source,
                "name": attr["name"],
                "label": attr["label"],
                "description": attr["description"],
                "data_type": attr["data_type"],
                "valid_range_min": attr.get("valid_range", [None, None])[0],
                "valid_range_max": attr.get("valid_range", [None, None])[1],
                "segment": attr.get("segment", ""),
                "special_values": json.dumps(attr.get("special_values", {})),
            }
            for port in PORTFOLIOS:
                stats = attr.get("typical_stats", {}).get(port, {})
                for metric in ["min", "max", "mean", "median", "std", "ks", "psi", "importance"]:
                    entry[f"{port}_{metric}"] = stats.get(metric)
            combined.append(entry)
    return combined


def write_dictionary_csv(combined, filepath):
    if not combined:
        return
    keys = list(combined[0].keys())
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(combined)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rng = random.Random(RANDOM_SEED)

    print("Loading data dictionaries...")
    dicts = load_dictionaries()

    total_attrs = sum(len(d["attributes"]) for d in dicts)
    print(f"  Loaded {len(dicts)} dictionaries with {total_attrs} total attributes")

    print("\nBuilding combined data dictionary CSV...")
    combined = build_combined_dictionary(dicts)
    dict_path = OUT_DIR / "combined_data_dictionary.csv"
    write_dictionary_csv(combined, dict_path)
    print(f"  -> {dict_path} ({len(combined)} attributes)")

    for portfolio in PORTFOLIOS:
        print(f"\nGenerating {RECORDS_PER_PORTFOLIO} records for {portfolio}...")
        rows = generate_portfolio_data(dicts, portfolio, rng)
        csv_path = OUT_DIR / f"{portfolio}_data.csv"
        write_csv(rows, csv_path)
        print(f"  -> {csv_path} ({len(rows)} rows, {len(rows[0])} columns)")

    # summary stats per portfolio
    print("\nGenerating portfolio summary statistics...")
    for portfolio in PORTFOLIOS:
        csv_path = OUT_DIR / f"{portfolio}_data.csv"
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        summary = []
        for d in dicts:
            for attr in d["attributes"]:
                name = attr["name"]
                stats = attr.get("typical_stats", {}).get(portfolio, {})
                if not stats or stats.get("mean") is None:
                    continue

                vals = []
                for r in rows:
                    v = r.get(name)
                    if v is not None:
                        try:
                            fv = float(v)
                            if fv >= 0:
                                vals.append(fv)
                        except ValueError:
                            pass

                if not vals:
                    continue

                actual_min = min(vals)
                actual_max = max(vals)
                actual_mean = sum(vals) / len(vals)
                n = len(vals)
                actual_std = math.sqrt(sum((x - actual_mean) ** 2 for x in vals) / max(n - 1, 1))

                summary.append({
                    "source": d["source"],
                    "attribute": name,
                    "label": attr["label"],
                    "segment": attr.get("segment", ""),
                    "data_type": attr["data_type"],
                    "n_records": n,
                    "n_missing": RECORDS_PER_PORTFOLIO - n,
                    "pct_missing": round((RECORDS_PER_PORTFOLIO - n) / RECORDS_PER_PORTFOLIO * 100, 2),
                    "actual_min": round(actual_min, 2),
                    "actual_max": round(actual_max, 2),
                    "actual_mean": round(actual_mean, 2),
                    "actual_std": round(actual_std, 2),
                    "dict_ks": stats.get("ks"),
                    "dict_psi": stats.get("psi"),
                    "dict_importance": stats.get("importance"),
                })

        stats_path = OUT_DIR / f"{portfolio}_summary_stats.csv"
        write_dictionary_csv(summary, stats_path)
        print(f"  -> {stats_path} ({len(summary)} attributes)")

    print("\nDone! All data generated in:", OUT_DIR)


if __name__ == "__main__":
    main()
