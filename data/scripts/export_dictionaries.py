#!/usr/bin/env python3
"""
Export credit bureau data dictionaries to individual CSV files and a single
Excel workbook with formatted sheets for each source + combined views.
"""

import json
import csv
import os
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

DICT_DIR = Path(__file__).resolve().parent.parent / "dictionaries"
OUT_DIR = Path(__file__).resolve().parent.parent / "generated"
PORTFOLIOS = ["auto_loan", "credit_card", "mortgage", "personal_loan"]
DICT_FILES = [
    ("experian.json", "Experian"),
    ("equifax.json", "Equifax"),
    ("transunion.json", "TransUnion"),
    ("lexisnexis.json", "LexisNexis"),
    ("internal.json", "Internal"),
    ("performance.json", "Performance"),
]

HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
HEADER_FONT = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
SUBHEADER_FILL = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
SUBHEADER_FONT = Font(name="Calibri", bold=True, size=10)
DATA_FONT = Font(name="Calibri", size=10)
WRAP_ALIGN = Alignment(wrap_text=True, vertical="top")
TOP_ALIGN = Alignment(vertical="top")
THIN_BORDER = Border(
    left=Side(style="thin", color="B0B0B0"),
    right=Side(style="thin", color="B0B0B0"),
    top=Side(style="thin", color="B0B0B0"),
    bottom=Side(style="thin", color="B0B0B0"),
)

SEGMENT_COLORS = {
    "score": "E8F5E9",
    "alternative_score": "E8F5E9",
    "depth_of_file": "E3F2FD",
    "time_on_file": "E3F2FD",
    "utilization": "FFF3E0",
    "balance": "FFF3E0",
    "delinquency": "FFEBEE",
    "derogatory": "FFEBEE",
    "inquiry": "F3E5F5",
    "new_credit": "F3E5F5",
    "payment_history": "E0F7FA",
    "public_record": "FBE9E7",
    "credit_capacity": "FFF3E0",
    "payment": "E0F7FA",
    "stability": "E8EAF6",
    "assets": "F1F8E9",
    "income": "F1F8E9",
    "identity": "E8EAF6",
    "fraud": "FFEBEE",
    "criminal": "FFEBEE",
    "employment": "F1F8E9",
    "application": "FFFDE7",
    "capacity": "FFF3E0",
    "collateral": "EFEBE9",
    "relationship": "E8EAF6",
    "deposit_behavior": "E0F7FA",
    "behavioral": "E8F5E9",
    "geography": "EFEBE9",
    "target": "FFCDD2",
    "performance": "E0F2F1",
    "loss": "FFCDD2",
    "pricing": "FFF9C4",
    "trended_data": "E8EAF6",
    "auto_specific": "E3F2FD",
    "mortgage_specific": "E3F2FD",
}


def load_dict(fname):
    with open(DICT_DIR / fname) as f:
        return json.load(f)


def flatten_attributes(d, source_name):
    rows = []
    for attr in d["attributes"]:
        sv = attr.get("special_values", {})
        sv_str = "; ".join(f"{k}={v}" for k, v in sv.items())
        vr = attr.get("valid_range", [None, None])

        row = {
            "Source": source_name,
            "Attribute Name": attr["name"],
            "Label": attr["label"],
            "Description": attr["description"],
            "Data Type": attr["data_type"],
            "Segment": attr.get("segment", ""),
            "Valid Range Min": vr[0],
            "Valid Range Max": vr[1],
            "Special Values": sv_str,
        }

        for port in PORTFOLIOS:
            stats = attr.get("typical_stats", {}).get(port, {})
            pfx = port.replace("_", " ").title().replace(" ", "_")
            row[f"{pfx}_Min"] = stats.get("min")
            row[f"{pfx}_Max"] = stats.get("max")
            row[f"{pfx}_Mean"] = stats.get("mean")
            row[f"{pfx}_Median"] = stats.get("median")
            row[f"{pfx}_Std"] = stats.get("std")
            row[f"{pfx}_KS"] = stats.get("ks")
            row[f"{pfx}_PSI"] = stats.get("psi")
            row[f"{pfx}_Importance"] = stats.get("importance")

        rows.append(row)
    return rows


def write_csv_file(rows, filepath):
    if not rows:
        return
    keys = list(rows[0].keys())
    with open(filepath, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)


def style_header_row(ws, row_num, max_col, fill=None, font=None):
    fill = fill or HEADER_FILL
    font = font or HEADER_FONT
    for col in range(1, max_col + 1):
        cell = ws.cell(row=row_num, column=col)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = THIN_BORDER


def auto_width(ws, max_col, max_row, min_w=10, max_w=40):
    for col in range(1, max_col + 1):
        longest = 0
        for row in range(1, min(max_row + 1, 50)):
            val = ws.cell(row=row, column=col).value
            if val:
                longest = max(longest, min(len(str(val)), max_w))
        ws.column_dimensions[get_column_letter(col)].width = max(longest + 2, min_w)


def add_source_sheet(wb, source_name, rows):
    ws = wb.create_sheet(title=source_name[:31])
    if not rows:
        return ws

    headers = list(rows[0].keys())
    # skip "Source" column for per-source sheets
    headers = [h for h in headers if h != "Source"]

    for ci, h in enumerate(headers, 1):
        ws.cell(row=1, column=ci, value=h)
    style_header_row(ws, 1, len(headers))

    for ri, row in enumerate(rows, 2):
        segment = row.get("Segment", "")
        seg_color = SEGMENT_COLORS.get(segment)
        seg_fill = PatternFill(start_color=seg_color, end_color=seg_color, fill_type="solid") if seg_color else None

        for ci, h in enumerate(headers, 1):
            cell = ws.cell(row=ri, column=ci, value=row.get(h))
            cell.font = DATA_FONT
            cell.border = THIN_BORDER
            if h in ("Description", "Special Values"):
                cell.alignment = WRAP_ALIGN
            else:
                cell.alignment = TOP_ALIGN
            if seg_fill and h not in ("Attribute Name", "Label", "Description", "Special Values"):
                cell.fill = seg_fill

    ws.freeze_panes = "C2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows)+1}"
    auto_width(ws, len(headers), len(rows) + 1)
    # widen description
    desc_col = headers.index("Description") + 1 if "Description" in headers else None
    if desc_col:
        ws.column_dimensions[get_column_letter(desc_col)].width = 55
    sv_col = headers.index("Special Values") + 1 if "Special Values" in headers else None
    if sv_col:
        ws.column_dimensions[get_column_letter(sv_col)].width = 50

    return ws


def add_combined_sheet(wb, all_rows):
    ws = wb.create_sheet(title="All Attributes")
    if not all_rows:
        return ws

    headers = list(all_rows[0].keys())
    for ci, h in enumerate(headers, 1):
        ws.cell(row=1, column=ci, value=h)
    style_header_row(ws, 1, len(headers))

    for ri, row in enumerate(all_rows, 2):
        for ci, h in enumerate(headers, 1):
            cell = ws.cell(row=ri, column=ci, value=row.get(h))
            cell.font = DATA_FONT
            cell.border = THIN_BORDER
            if h in ("Description", "Special Values"):
                cell.alignment = WRAP_ALIGN
            else:
                cell.alignment = TOP_ALIGN

    ws.freeze_panes = "D2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(all_rows)+1}"
    auto_width(ws, len(headers), len(all_rows) + 1)
    desc_col = headers.index("Description") + 1 if "Description" in headers else None
    if desc_col:
        ws.column_dimensions[get_column_letter(desc_col)].width = 55
    return ws


def add_portfolio_view_sheet(wb, all_rows, portfolio):
    port_title = portfolio.replace("_", " ").title()
    pfx = portfolio.replace("_", " ").title().replace(" ", "_")
    ws = wb.create_sheet(title=port_title[:31])

    headers = [
        "Source", "Attribute Name", "Label", "Description", "Data Type",
        "Segment", "Valid Range Min", "Valid Range Max", "Special Values",
        "Min", "Max", "Mean", "Median", "Std", "KS", "PSI", "Importance",
    ]
    for ci, h in enumerate(headers, 1):
        ws.cell(row=1, column=ci, value=h)
    style_header_row(ws, 1, len(headers))

    ri = 2
    for row in all_rows:
        mean_val = row.get(f"{pfx}_Mean")
        if mean_val is None:
            continue

        ws.cell(row=ri, column=1, value=row["Source"])
        ws.cell(row=ri, column=2, value=row["Attribute Name"])
        ws.cell(row=ri, column=3, value=row["Label"])
        ws.cell(row=ri, column=4, value=row["Description"])
        ws.cell(row=ri, column=5, value=row["Data Type"])
        ws.cell(row=ri, column=6, value=row["Segment"])
        ws.cell(row=ri, column=7, value=row["Valid Range Min"])
        ws.cell(row=ri, column=8, value=row["Valid Range Max"])
        ws.cell(row=ri, column=9, value=row["Special Values"])
        ws.cell(row=ri, column=10, value=row.get(f"{pfx}_Min"))
        ws.cell(row=ri, column=11, value=row.get(f"{pfx}_Max"))
        ws.cell(row=ri, column=12, value=row.get(f"{pfx}_Mean"))
        ws.cell(row=ri, column=13, value=row.get(f"{pfx}_Median"))
        ws.cell(row=ri, column=14, value=row.get(f"{pfx}_Std"))
        ws.cell(row=ri, column=15, value=row.get(f"{pfx}_KS"))
        ws.cell(row=ri, column=16, value=row.get(f"{pfx}_PSI"))
        ws.cell(row=ri, column=17, value=row.get(f"{pfx}_Importance"))

        segment = row.get("Segment", "")
        seg_color = SEGMENT_COLORS.get(segment)
        seg_fill = PatternFill(start_color=seg_color, end_color=seg_color, fill_type="solid") if seg_color else None

        for ci in range(1, len(headers) + 1):
            cell = ws.cell(row=ri, column=ci)
            cell.font = DATA_FONT
            cell.border = THIN_BORDER
            if ci in (4, 9):
                cell.alignment = WRAP_ALIGN
            else:
                cell.alignment = TOP_ALIGN
            if seg_fill and ci >= 10:
                cell.fill = seg_fill

        # color importance column by value
        imp_cell = ws.cell(row=ri, column=17)
        imp_val = imp_cell.value
        if imp_val and isinstance(imp_val, (int, float)):
            if imp_val >= 0.20:
                imp_cell.fill = PatternFill(start_color="C62828", end_color="C62828", fill_type="solid")
                imp_cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            elif imp_val >= 0.15:
                imp_cell.fill = PatternFill(start_color="EF6C00", end_color="EF6C00", fill_type="solid")
                imp_cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            elif imp_val >= 0.10:
                imp_cell.fill = PatternFill(start_color="FFA726", end_color="FFA726", fill_type="solid")
                imp_cell.font = Font(name="Calibri", size=10, bold=True)

        ri += 1

    ws.freeze_panes = "D2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{ri-1}"
    auto_width(ws, len(headers), ri)
    ws.column_dimensions[get_column_letter(4)].width = 55
    ws.column_dimensions[get_column_letter(9)].width = 50
    return ws


def add_overview_sheet(wb, sources_info):
    ws = wb.create_sheet(title="Overview")
    ws.sheet_properties.tabColor = "1F4E79"

    ws.merge_cells("A1:F1")
    title_cell = ws.cell(row=1, column=1, value="Credit Bureau Data Dictionary Workbook")
    title_cell.font = Font(name="Calibri", bold=True, size=16, color="1F4E79")
    title_cell.alignment = Alignment(horizontal="center")

    ws.merge_cells("A2:F2")
    ws.cell(row=2, column=1, value="For AI Agent Testing — Attribute Explorer & Model Diagnostics").font = Font(
        name="Calibri", size=12, italic=True, color="666666"
    )
    ws.cell(row=2, column=1).alignment = Alignment(horizontal="center")

    row = 4
    headers = ["Source", "Description", "# Attributes", "Key Segments", "Sheet Name"]
    for ci, h in enumerate(headers, 1):
        ws.cell(row=row, column=ci, value=h)
    style_header_row(ws, row, len(headers))

    for si in sources_info:
        row += 1
        ws.cell(row=row, column=1, value=si["source"]).font = Font(name="Calibri", size=10, bold=True)
        ws.cell(row=row, column=2, value=si["description"]).font = DATA_FONT
        ws.cell(row=row, column=3, value=si["count"]).font = DATA_FONT
        ws.cell(row=row, column=4, value=si["segments"]).font = DATA_FONT
        ws.cell(row=row, column=5, value=si["sheet"]).font = DATA_FONT
        for ci in range(1, 6):
            ws.cell(row=row, column=ci).border = THIN_BORDER
            ws.cell(row=row, column=ci).alignment = WRAP_ALIGN

    row += 2
    ws.cell(row=row, column=1, value="Portfolio Views").font = Font(name="Calibri", bold=True, size=12, color="1F4E79")
    row += 1
    for port in PORTFOLIOS:
        port_title = port.replace("_", " ").title()
        ws.cell(row=row, column=1, value=f"  {port_title}").font = DATA_FONT
        ws.cell(row=row, column=2, value=f"All attributes filtered and stats for {port_title} portfolio").font = DATA_FONT
        row += 1

    row += 1
    ws.cell(row=row, column=1, value="Column Definitions").font = Font(name="Calibri", bold=True, size=12, color="1F4E79")
    definitions = [
        ("KS", "Kolmogorov-Smirnov statistic — measures separation between good/bad distributions (higher = more discriminating)"),
        ("PSI", "Population Stability Index — measures drift between development and recent populations (>0.25 = significant shift)"),
        ("Importance", "Feature importance to the target variable (e.g., 90+ DPD) — ranges 0 to 1, higher = more predictive"),
        ("Special Values", "Codes for missing data, not applicable, or sentinel values (typically negative integers)"),
        ("Segment", "Logical grouping of the attribute (score, delinquency, utilization, etc.)"),
    ]
    for defn in definitions:
        row += 1
        ws.cell(row=row, column=1, value=defn[0]).font = Font(name="Calibri", size=10, bold=True)
        ws.cell(row=row, column=2, value=defn[1]).font = DATA_FONT
        ws.cell(row=row, column=2).alignment = WRAP_ALIGN

    ws.column_dimensions["A"].width = 20
    ws.column_dimensions["B"].width = 65
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 35
    ws.column_dimensions["E"].width = 18

    return ws


def add_use_cases_sheet(wb):
    ws = wb.create_sheet(title="AI Use Cases")
    ws.sheet_properties.tabColor = "2E7D32"

    ws.merge_cells("A1:G1")
    title_cell = ws.cell(row=1, column=1, value="AI Agent Use Cases for Credit Risk Modeling")
    title_cell.font = Font(name="Calibri", bold=True, size=16, color="1F4E79")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    ws.merge_cells("A2:G2")
    ws.cell(row=2, column=1, value="Comprehensive catalog of how the AI agent helps modelers across the credit risk lifecycle").font = Font(
        name="Calibri", size=11, italic=True, color="666666"
    )
    ws.cell(row=2, column=1).alignment = Alignment(horizontal="center")

    headers = ["#", "Category", "Use Case", "Description", "Example Prompt to Agent", "Data Sources Used", "Value to Modeler"]
    row = 4
    for ci, h in enumerate(headers, 1):
        ws.cell(row=row, column=ci, value=h)
    style_header_row(ws, row, len(headers))

    use_cases = [
        # --- DATA EXPLORATION & UNDERSTANDING ---
        {
            "cat": "Data Exploration & Understanding",
            "cases": [
                (
                    "Attribute Lookup",
                    "Look up any attribute by name or keyword and get its full definition, valid ranges, special values, data type, and which bureau/source it comes from.",
                    "What is REVOL_UTIL? What are its valid values and what do the special codes mean?",
                    "Experian, Equifax, TransUnion, LexisNexis, Internal",
                    "Eliminates time spent searching through PDF documentation or asking senior analysts. Instant, accurate answers."
                ),
                (
                    "Attribute Comparison Across Bureaus",
                    "Compare similar attributes across Experian, Equifax, and TransUnion to understand differences in naming, ranges, and definitions.",
                    "Compare revolving utilization across all three bureaus — how do they differ in definition and typical ranges?",
                    "Experian, Equifax, TransUnion",
                    "Prevents errors when merging multi-bureau data. Clarifies subtle definitional differences that affect model performance."
                ),
                (
                    "Special Value Decoder",
                    "Explain what each special/sentinel value means for an attribute (e.g., -1 = No Data, -5 = No Hit) and how to handle them in modeling.",
                    "What do the negative values in EFX_BEACON_5 mean and how should I treat them in my model?",
                    "All Sources",
                    "Prevents silent data errors — miscoding a -1 (thin file) as a real value corrupts model training."
                ),
                (
                    "Segment-Based Attribute Discovery",
                    "Find all attributes in a segment (e.g., delinquency, utilization, scores) across all sources to see the full landscape.",
                    "Show me all delinquency-related attributes across all bureaus and internal data.",
                    "All Sources",
                    "Accelerates feature selection by surfacing all available features in a risk dimension."
                ),
                (
                    "Data Type & Range Validation Guide",
                    "For any attribute, get the expected data type, valid range, and flag values outside range as potential data quality issues.",
                    "What is the expected range for NUM_30DPD_12M and what would be considered an outlier?",
                    "All Sources",
                    "Catches data quality issues early before they propagate into model development."
                ),
                (
                    "New Modeler Onboarding",
                    "Walk a new modeler through the complete attribute landscape — what each source provides, key differences, and where to start.",
                    "I'm new to credit modeling. Walk me through what data we have from each bureau and what the internal data covers.",
                    "All Sources",
                    "Reduces onboarding time from weeks to hours. New modelers become productive immediately."
                ),
            ]
        },
        # --- STATISTICAL ANALYSIS & DIAGNOSTICS ---
        {
            "cat": "Statistical Analysis & Diagnostics",
            "cases": [
                (
                    "Univariate Statistics Summary",
                    "Get min, max, mean, median, and standard deviation for any attribute, broken out by portfolio.",
                    "What are the descriptive statistics for FICO Score V2 across all four portfolios?",
                    "All Sources + Generated Data",
                    "Instant statistical profiling without writing code or running queries."
                ),
                (
                    "KS Statistic Interpretation",
                    "Explain the Kolmogorov-Smirnov (KS) statistic for each attribute, what it measures, and rank attributes by discriminatory power.",
                    "Which attributes have the highest KS for the auto loan portfolio? What does a KS of 42 mean?",
                    "All Sources",
                    "Prioritizes features by how well they separate good from bad — essential for scorecard development."
                ),
                (
                    "PSI Monitoring & Drift Detection",
                    "Check Population Stability Index for each attribute to detect distribution shifts between development and recent data.",
                    "Which attributes show PSI above 0.10 for personal loans? Should I be concerned about population drift?",
                    "All Sources",
                    "Early warning system for model degradation. Attributes with high PSI may need recalibration."
                ),
                (
                    "Feature Importance Ranking",
                    "Rank all attributes by their importance to the target variable for a specific portfolio.",
                    "Rank the top 20 most important attributes for predicting 90+ DPD in the credit card portfolio.",
                    "All Sources",
                    "Guides feature selection and helps modelers focus on high-value attributes first."
                ),
                (
                    "Cross-Portfolio Comparison",
                    "Compare how an attribute behaves differently across portfolios (auto vs. credit card vs. mortgage vs. personal loan).",
                    "How does revolving utilization differ in importance and distribution between auto loans and credit cards?",
                    "All Sources",
                    "Reveals portfolio-specific patterns that inform whether to build separate models or a single model."
                ),
                (
                    "Distribution Profiling",
                    "Describe the shape of an attribute's distribution (skewed, bimodal, zero-inflated) and implications for modeling.",
                    "Describe the distribution of NUM_COLLECTIONS — is it zero-inflated? How should I transform it?",
                    "All Sources + Generated Data",
                    "Informs transformation decisions (log, WoE binning) and whether to treat as continuous or categorical."
                ),
                (
                    "Outlier & Anomaly Identification",
                    "Flag records or attribute values that fall outside expected ranges or show suspicious patterns.",
                    "Are there any records in the auto loan data where FICO is above 850 or below 300? What about negative balances?",
                    "Generated Data",
                    "Data quality gate before model development — catch impossible values before they bias the model."
                ),
            ]
        },
        # --- MODEL DEVELOPMENT SUPPORT ---
        {
            "cat": "Model Development Support",
            "cases": [
                (
                    "Feature Selection Guidance",
                    "Recommend which features to include in a model based on KS, importance, correlation, and practical considerations.",
                    "I'm building an auto loan scorecard. Which 15 features should I start with and why?",
                    "All Sources",
                    "Expert-level feature selection advice that balances statistical power with interpretability and regulatory requirements."
                ),
                (
                    "Multicollinearity Assessment",
                    "Identify attributes likely to be highly correlated (e.g., multiple score versions, overlapping balance measures) and recommend which to keep.",
                    "FICOCV2 and FICOCV3 seem similar — should I include both in my model? What about all the balance attributes?",
                    "All Sources",
                    "Prevents multicollinearity issues that inflate variance and make coefficients unstable."
                ),
                (
                    "Target Variable Selection",
                    "Compare available target definitions (30 DPD, 60 DPD, 90 DPD, charge-off) and recommend the best for a given use case.",
                    "Should I use 60+ DPD at 12 months or 90+ DPD at 24 months as my target for an auto loan PD model?",
                    "Performance",
                    "Aligns model objective with business need and regulatory requirements (Basel, CECL)."
                ),
                (
                    "Missing Data Strategy",
                    "Analyze missing rates per attribute and recommend imputation strategies (mean, median, WoE bin, separate indicator).",
                    "Which attributes have high missing rates for mortgage? What imputation approach do you recommend for each?",
                    "All Sources + Generated Data",
                    "Prevents information loss from naive imputation and ensures special values are handled correctly."
                ),
                (
                    "WoE / IV Binning Guidance",
                    "Advise on Weight of Evidence binning strategies for each attribute type (continuous, categorical, zero-inflated).",
                    "How should I bin OLDEST_TL_MTHS for WoE analysis? What bin boundaries would you recommend?",
                    "All Sources",
                    "Accelerates the tedious binning process with informed starting points based on attribute characteristics."
                ),
                (
                    "Reject Inference Support",
                    "Identify which attributes are available at application (pre-decision) vs. only post-booking for reject inference.",
                    "Which internal attributes are available at application time and which are only available after booking?",
                    "Internal, Performance",
                    "Ensures reject inference uses only through-the-door attributes, preventing data leakage."
                ),
                (
                    "Scorecard Reason Code Mapping",
                    "Map model features to human-readable adverse action reason codes required under ECOA/FCRA.",
                    "If REVOL_UTIL is a top driver of decline, what adverse action reason code should we assign?",
                    "All Sources",
                    "Regulatory compliance — every decline must provide specific, accurate reasons to the applicant."
                ),
            ]
        },
        # --- MODEL VALIDATION & MONITORING ---
        {
            "cat": "Model Validation & Monitoring",
            "cases": [
                (
                    "Model Performance Benchmarking",
                    "Compare expected KS and feature importance against actual model performance to identify potential issues.",
                    "My auto loan model has a KS of 35 — is that good? How does it compare to what we'd expect from the feature set?",
                    "All Sources",
                    "Reality check on model performance — is the model extracting expected information from the features?"
                ),
                (
                    "Population Stability Monitoring",
                    "Monitor PSI trends across all features to detect when the applicant population has shifted.",
                    "Run a PSI check across all features for the personal loan portfolio. Which ones are drifting?",
                    "All Sources",
                    "Proactive model risk management — detect drift before it degrades model performance."
                ),
                (
                    "Feature Contribution Analysis",
                    "Analyze whether each feature's importance has changed over time compared to development.",
                    "Has the importance of credit scores decreased relative to delinquency counts in recent data?",
                    "All Sources + Generated Data",
                    "Detects structural changes in the relationship between features and default."
                ),
                (
                    "Challenger Model Support",
                    "Identify new features or alternative data sources that could improve an existing model.",
                    "We have a FICO-only auto model. What LexisNexis or CreditVision features could add lift?",
                    "LexisNexis, TransUnion CreditVision",
                    "Guides challenger model development with data-driven feature recommendations."
                ),
                (
                    "Vintage Analysis Support",
                    "Use origination dates and performance windows to structure vintage-based model monitoring.",
                    "How should I set up vintage cohorts for monitoring the mortgage portfolio's 90 DPD rate?",
                    "Performance",
                    "Structures the performance monitoring framework to catch deterioration by origination cohort."
                ),
                (
                    "Back-Testing Validation",
                    "Compare model predictions against actual outcomes using the performance data.",
                    "Show me the actual 90+ DPD rate by FICO decile for the auto loan portfolio.",
                    "All Sources + Performance + Generated Data",
                    "Validates that the model rank-orders risk correctly across the score range."
                ),
            ]
        },
        # --- REGULATORY & COMPLIANCE ---
        {
            "cat": "Regulatory & Compliance",
            "cases": [
                (
                    "Fair Lending Analysis Support",
                    "Identify attributes that may serve as proxies for prohibited bases (race, gender, age) and flag for disparate impact testing.",
                    "Which LexisNexis attributes could be proxies for protected classes? Should we exclude any from a fair lending perspective?",
                    "LexisNexis, Internal",
                    "Proactive fair lending risk identification before model goes to compliance review."
                ),
                (
                    "Model Documentation Generation",
                    "Generate model development documentation sections including feature definitions, data sources, and summary statistics.",
                    "Generate the 'Data Description' section for my model document covering all Experian attributes used.",
                    "All Sources",
                    "Automates the most tedious part of MRM documentation — accurate, consistent, and audit-ready."
                ),
                (
                    "CECL / IFRS 9 Feature Mapping",
                    "Map attributes to CECL lifetime loss estimation requirements — PD, LGD, EAD components.",
                    "Which attributes best predict loss given default for the mortgage portfolio? Map them to CECL requirements.",
                    "All Sources + Performance",
                    "Bridges the gap between data dictionary and regulatory model requirements."
                ),
                (
                    "SR 26-3 / OCC 2011-12 Compliance Check",
                    "Verify that model features, data sources, and performance metrics align with regulatory guidance on model risk management.",
                    "Does our feature set meet SR 26-3 expectations for conceptual soundness? Are there any gaps?",
                    "All Sources",
                    "Ensures the model passes MRM review by checking features against SR 26-3 regulatory expectations."
                ),
                (
                    "FCRA Permissible Purpose Verification",
                    "Verify that each data source and attribute is used within its permissible purpose under FCRA.",
                    "Can I use LexisNexis criminal records in an auto loan origination model? What are the FCRA implications?",
                    "LexisNexis, All Sources",
                    "Prevents compliance violations from using data outside permissible purpose."
                ),
            ]
        },
        # --- DATA ENGINEERING & OPERATIONS ---
        {
            "cat": "Data Engineering & Operations",
            "cases": [
                (
                    "ETL Validation Rules Generation",
                    "Generate data validation rules (range checks, type checks, special value handling) for ETL pipelines.",
                    "Generate validation rules for all Equifax attributes — range checks, null handling, and special value mapping.",
                    "All Sources",
                    "Automates creation of data quality checks for production ETL pipelines."
                ),
                (
                    "Data Mapping Across Sources",
                    "Create a crosswalk between similar attributes across bureaus for multi-bureau data integration.",
                    "Create a mapping table showing equivalent attributes across Experian, Equifax, and TransUnion.",
                    "Experian, Equifax, TransUnion",
                    "Enables consistent multi-bureau feature engineering without manual cross-referencing."
                ),
                (
                    "Schema Documentation",
                    "Generate database schema documentation including column names, types, constraints, and descriptions.",
                    "Generate a CREATE TABLE DDL statement for the auto loan feature table with all attribute definitions as comments.",
                    "All Sources",
                    "Speeds up data warehouse setup with accurate, documented schemas."
                ),
                (
                    "Data Quality Report Generation",
                    "Produce a comprehensive data quality report covering completeness, validity, and distribution checks.",
                    "Generate a data quality report for the personal loan portfolio covering all 107 attributes.",
                    "All Sources + Generated Data",
                    "Automated QA reporting that would otherwise take analysts days to compile manually."
                ),
                (
                    "Feature Store Documentation",
                    "Document features for a feature store including metadata, lineage, freshness, and usage.",
                    "Document all TransUnion CreditVision attributes for our feature store — include refresh frequency and downstream models.",
                    "TransUnion",
                    "Enables feature reuse across models and teams with proper governance metadata."
                ),
            ]
        },
        # --- BUSINESS INTELLIGENCE & REPORTING ---
        {
            "cat": "Business Intelligence & Reporting",
            "cases": [
                (
                    "Portfolio Risk Profile",
                    "Generate a risk profile summary for any portfolio showing key risk indicators and their distributions.",
                    "Give me a risk profile of the auto loan portfolio — what does the typical applicant look like across all key metrics?",
                    "All Sources + Generated Data",
                    "Instant portfolio-level insights for management reporting and strategy discussions."
                ),
                (
                    "Segment Comparison Dashboard",
                    "Compare risk characteristics across segments (e.g., prime vs. subprime, new vs. existing customers).",
                    "Compare the risk profile of existing customers vs. new customers applying for personal loans.",
                    "Internal + All Sources",
                    "Data-driven segmentation insights for pricing and policy decisions."
                ),
                (
                    "Trend Analysis & Early Warning",
                    "Identify attributes showing adverse trends that may signal portfolio deterioration.",
                    "Which attributes in the credit card portfolio show worsening trends based on PSI and distribution shifts?",
                    "All Sources",
                    "Early warning system for portfolio managers to take preemptive action."
                ),
                (
                    "Executive Summary Generation",
                    "Create non-technical summaries of model features and performance for executive stakeholders.",
                    "Summarize our auto loan model's key risk drivers in plain English for the Chief Risk Officer.",
                    "All Sources",
                    "Bridges the gap between technical model output and business-level understanding."
                ),
                (
                    "Loss Forecasting Support",
                    "Use performance data and feature distributions to support loss forecasting and stress testing.",
                    "Based on current portfolio composition, what loss rate should we expect for the personal loan book?",
                    "Performance + All Sources",
                    "Connects bottom-up feature analysis to top-down loss forecasting."
                ),
            ]
        },
        # --- ADVANCED ANALYTICS ---
        {
            "cat": "Advanced Analytics & ML",
            "cases": [
                (
                    "Alternative Data Assessment",
                    "Evaluate the incremental value of LexisNexis alternative data over traditional bureau data.",
                    "How much lift would adding LexisNexis RiskView and address stability provide over bureau scores alone for thin-file applicants?",
                    "LexisNexis + Bureau Sources",
                    "Quantifies the business case for purchasing additional data sources."
                ),
                (
                    "Feature Engineering Ideas",
                    "Suggest derived features and interaction terms based on the raw attributes available.",
                    "What feature interactions or ratios should I create from the bureau and internal data for a personal loan model?",
                    "All Sources",
                    "Accelerates feature engineering with domain-informed suggestions (e.g., payment-to-income ratios, utilization trends)."
                ),
                (
                    "ML vs. Scorecard Feature Selection",
                    "Compare feature recommendations for a traditional logistic regression scorecard vs. a gradient boosted model.",
                    "I'm building both a scorecard and an XGBoost model for auto loans — how should feature selection differ between them?",
                    "All Sources",
                    "Tailored feature strategies for different modeling approaches — scorecards need fewer, interpretable features while ML can use more."
                ),
                (
                    "Trended Data Strategy",
                    "Advise on using TransUnion CreditVision trended data features (payment velocity, balance trends) effectively.",
                    "How should I incorporate CreditVision payment velocity and balance trend into my credit card model?",
                    "TransUnion CreditVision",
                    "Unlocks value from trended data — a newer data dimension many modelers underutilize."
                ),
                (
                    "Model Explainability Support",
                    "Help interpret model outputs by connecting predictions back to individual feature contributions and definitions.",
                    "A customer was declined — explain which features drove the decision and what each one means in plain language.",
                    "All Sources",
                    "Supports SHAP/LIME explainability by providing human-readable context for each feature contribution."
                ),
            ]
        },
    ]

    row = 5
    case_num = 0
    for group in use_cases:
        cat = group["cat"]
        cat_fill = PatternFill(start_color="E8F0FE", end_color="E8F0FE", fill_type="solid")
        cat_font = Font(name="Calibri", bold=True, size=11, color="1F4E79")

        ws.merge_cells(f"A{row}:G{row}")
        cat_cell = ws.cell(row=row, column=1, value=cat)
        cat_cell.font = cat_font
        cat_cell.fill = cat_fill
        cat_cell.alignment = Alignment(vertical="center")
        for ci in range(1, 8):
            ws.cell(row=row, column=ci).fill = cat_fill
            ws.cell(row=row, column=ci).border = THIN_BORDER
        ws.row_dimensions[row].height = 22
        row += 1

        for case_name, desc, prompt, sources, value in group["cases"]:
            case_num += 1
            ws.cell(row=row, column=1, value=case_num).font = DATA_FONT
            ws.cell(row=row, column=1).alignment = Alignment(horizontal="center", vertical="top")
            ws.cell(row=row, column=2, value=cat).font = Font(name="Calibri", size=9, color="888888")
            ws.cell(row=row, column=3, value=case_name).font = Font(name="Calibri", size=10, bold=True)
            ws.cell(row=row, column=4, value=desc).font = DATA_FONT
            ws.cell(row=row, column=5, value=prompt).font = Font(name="Calibri", size=10, italic=True, color="2E7D32")
            ws.cell(row=row, column=6, value=sources).font = DATA_FONT
            ws.cell(row=row, column=7, value=value).font = DATA_FONT

            for ci in range(1, 8):
                ws.cell(row=row, column=ci).border = THIN_BORDER
                if ci >= 3:
                    ws.cell(row=row, column=ci).alignment = WRAP_ALIGN
                else:
                    ws.cell(row=row, column=ci).alignment = TOP_ALIGN

            ws.row_dimensions[row].height = 60
            row += 1

    # summary at bottom
    row += 1
    ws.merge_cells(f"A{row}:G{row}")
    ws.cell(row=row, column=1, value=f"Total: {case_num} use cases across {len(use_cases)} categories").font = Font(
        name="Calibri", bold=True, size=12, color="1F4E79"
    )

    ws.freeze_panes = "A5"
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 30
    ws.column_dimensions["D"].width = 50
    ws.column_dimensions["E"].width = 55
    ws.column_dimensions["F"].width = 25
    ws.column_dimensions["G"].width = 45

    return ws


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    all_rows = []
    sources_info = []

    # per-source CSVs and collect rows
    for fname, source_name in DICT_FILES:
        d = load_dict(fname)
        rows = flatten_attributes(d, source_name)
        all_rows.extend(rows)

        csv_path = OUT_DIR / f"dictionary_{source_name.lower()}.csv"
        write_csv_file(rows, csv_path)
        print(f"CSV: {csv_path} ({len(rows)} attributes)")

        segments = sorted(set(r["Segment"] for r in rows if r["Segment"]))
        sources_info.append({
            "source": source_name,
            "description": d.get("description", ""),
            "count": len(rows),
            "segments": ", ".join(segments),
            "sheet": source_name[:31],
        })

    # combined CSV
    combined_csv = OUT_DIR / "dictionary_all_sources.csv"
    write_csv_file(all_rows, combined_csv)
    print(f"\nCombined CSV: {combined_csv} ({len(all_rows)} attributes)")

    # Excel workbook
    print("\nBuilding Excel workbook...")
    wb = Workbook()
    wb.remove(wb.active)

    add_overview_sheet(wb, sources_info)

    for fname, source_name in DICT_FILES:
        d = load_dict(fname)
        rows = flatten_attributes(d, source_name)
        add_source_sheet(wb, source_name, rows)
        print(f"  Sheet: {source_name} ({len(rows)} rows)")

    add_combined_sheet(wb, all_rows)
    print(f"  Sheet: All Attributes ({len(all_rows)} rows)")

    for portfolio in PORTFOLIOS:
        add_portfolio_view_sheet(wb, all_rows, portfolio)
        port_title = portfolio.replace("_", " ").title()
        print(f"  Sheet: {port_title} (portfolio view)")

    add_use_cases_sheet(wb)
    print(f"  Sheet: AI Use Cases")

    xlsx_path = OUT_DIR / "credit_bureau_data_dictionaries.xlsx"
    wb.save(xlsx_path)
    print(f"\nExcel workbook: {xlsx_path}")
    print(f"  Sheets: {len(wb.sheetnames)} — {', '.join(wb.sheetnames)}")
    print("\nDone!")


if __name__ == "__main__":
    main()
