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

    xlsx_path = OUT_DIR / "credit_bureau_data_dictionaries.xlsx"
    wb.save(xlsx_path)
    print(f"\nExcel workbook: {xlsx_path}")
    print(f"  Sheets: {len(wb.sheetnames)} — {', '.join(wb.sheetnames)}")
    print("\nDone!")


if __name__ == "__main__":
    main()
