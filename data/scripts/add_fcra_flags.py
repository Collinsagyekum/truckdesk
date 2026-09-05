#!/usr/bin/env python3
"""
Add fcra_regulated field to all attributes in all data dictionaries.
FCRA applies to data from consumer reporting agencies (CRAs) — the three
bureaus and LexisNexis when acting as a CRA. Internal data that is not
sourced from a CRA is generally not FCRA-regulated.
"""

import json
from pathlib import Path

DICT_DIR = Path(__file__).resolve().parent.parent / "dictionaries"

FCRA_RULES = {
    "Experian": {
        "default": True,
        "note_default": "Experian is a consumer reporting agency (CRA). All attributes from the consumer credit file are FCRA-regulated.",
    },
    "Equifax": {
        "default": True,
        "note_default": "Equifax is a consumer reporting agency (CRA). All attributes from the consumer credit file are FCRA-regulated.",
    },
    "TransUnion": {
        "default": True,
        "note_default": "TransUnion is a consumer reporting agency (CRA). All attributes from the consumer credit file are FCRA-regulated.",
    },
    "LexisNexis": {
        "default": True,
        "note_default": "LexisNexis RiskView operates as a CRA under FCRA when providing consumer reports for credit decisions.",
        "overrides": {
            "LN_FRAUD_POINT_SCORE": {
                "fcra_regulated": True,
                "fcra_note": "FCRA-regulated when used in credit decisions. Also subject to GLBA safeguards. Fraud scores from CRAs require permissible purpose."
            },
            "LN_NUM_FELONIES": {
                "fcra_regulated": True,
                "fcra_note": "FCRA-regulated. Criminal records from a CRA are subject to FCRA Section 605 time limits (7 years for arrests, 10 years for convictions in some states). Many states restrict use in credit decisions."
            },
            "LN_NUM_EVICTIONS": {
                "fcra_regulated": True,
                "fcra_note": "FCRA-regulated. Eviction records from a CRA are subject to FCRA accuracy and dispute requirements. Some jurisdictions restrict use in credit decisions."
            },
            "LN_NUM_TAX_LIENS": {
                "fcra_regulated": True,
                "fcra_note": "FCRA-regulated. Tax lien data from a CRA is subject to FCRA. Note: major CRAs removed most tax liens from credit files in 2018 due to data quality concerns."
            },
            "LN_ID_VERIFICATION": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated when used solely for identity verification/authentication under FCRA Section 604(a)(2) fraud prevention permissible purpose, separate from credit decisioning."
            },
            "LN_PHONE_VERIFICATION": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated when used solely for identity verification/authentication purposes. Does not constitute a consumer report when used outside credit decisioning."
            },
        }
    },
    "Internal": {
        "default": False,
        "note_default": "Internal data generated from the institution's own records and applications is not sourced from a CRA and is generally not FCRA-regulated.",
        "overrides": {
            "INT_INTERNAL_SCORE": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated as an internally developed score. However, if the score incorporates CRA data as inputs, adverse action notice requirements under ECOA/Regulation B still apply."
            },
            "INT_APP_STATED_INCOME": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated. Self-reported by the applicant. However, if income is verified through a CRA product (e.g., The Work Number), that verification data is FCRA-regulated."
            },
        }
    },
    "Internal_Performance": {
        "default": False,
        "note_default": "Performance data is generated internally from account servicing systems and is not sourced from a CRA. Not FCRA-regulated, though furnishing this data to CRAs triggers FCRA furnisher obligations.",
        "overrides": {
            "PERF_TARGET_30DPD_12M": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated as internal performance data. However, when this delinquency status is furnished to a CRA, the institution becomes a furnisher under FCRA Section 623 with accuracy and dispute obligations."
            },
            "PERF_TARGET_60DPD_12M": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated as internal data. Furnishing obligations apply when reported to CRAs."
            },
            "PERF_TARGET_90DPD_24M": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated as internal data. Furnishing obligations apply when reported to CRAs."
            },
            "PERF_TARGET_CHARGEOFF_24M": {
                "fcra_regulated": False,
                "fcra_note": "Not FCRA-regulated as internal data. Charge-off status when furnished to CRAs must comply with FCRA accuracy requirements and Metro 2 reporting standards."
            },
        }
    },
}


def process_dict(fpath, source_key):
    with open(fpath) as f:
        d = json.load(f)

    rules = FCRA_RULES[source_key]
    default_regulated = rules["default"]
    default_note = rules["note_default"]
    overrides = rules.get("overrides", {})

    for attr in d["attributes"]:
        name = attr["name"]
        if name in overrides:
            attr["fcra_regulated"] = overrides[name]["fcra_regulated"]
            attr["fcra_note"] = overrides[name]["fcra_note"]
        else:
            attr["fcra_regulated"] = default_regulated
            attr["fcra_note"] = default_note

    with open(fpath, "w") as f:
        json.dump(d, f, indent=2)

    regulated_count = sum(1 for a in d["attributes"] if a["fcra_regulated"])
    total = len(d["attributes"])
    print(f"  {source_key}: {regulated_count}/{total} FCRA-regulated")


def main():
    files = [
        ("experian.json", "Experian"),
        ("equifax.json", "Equifax"),
        ("transunion.json", "TransUnion"),
        ("lexisnexis.json", "LexisNexis"),
        ("internal.json", "Internal"),
        ("performance.json", "Internal_Performance"),
    ]

    print("Adding FCRA flags to all dictionaries...")
    for fname, source_key in files:
        process_dict(DICT_DIR / fname, source_key)

    print("\nDone! Now re-run export_dictionaries.py to update CSVs and Excel.")


if __name__ == "__main__":
    main()
