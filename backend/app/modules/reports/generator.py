import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
    PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

from app.models.dataset import Dataset
from app.models.product import Product
from app.models.sales_data import SalesData
from app.models.bill import Bill, BillItem
from app.modules.health.scorer import compute_health_score
from app.modules.alerts.checker import check_festival_alerts

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "reports")


def _ensure_reports_dir():
    os.makedirs(REPORTS_DIR, exist_ok=True)


def compute_stock_status(stock: int, reorder_point: int) -> str:
    """Classify product stock status according to store standards."""
    if stock <= max(1, reorder_point // 3):
        return "CRITICAL"
    elif stock <= reorder_point:
        return "LOW"
    elif stock >= (reorder_point * 6):
        return "OVERSTOCK"
    else:
        return "OPTIMAL"


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and draw accurate 'Page X of Y' footers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        
        # Bottom divider
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.75)
        self.line(36, 32, 559, 32)
        
        # Left footer branding
        self.drawString(36, 20, "BusinessGPT | Executive Business Intelligence & Audit Dossier")
        # Right footer page number
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(559, 20, page_str)
        self.restoreState()


def resolve_report_dates(
    db: Session,
    period: str = "daily",
    target_date_str: Optional[str] = None,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> Tuple[date, date, str, str]:
    """
    Resolve authoritative date boundaries and textual labels for the report.
    Returns: (start_date, end_date, title_label, date_range_label)
    """
    period_lower = (period or "daily").strip().lower()

    # 1. Explicit start and end date overrides
    if start_date_str and end_date_str:
        try:
            s_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
            return s_date, e_date, "Custom Intelligence Report", f"{s_date.strftime('%d %b %Y')} to {e_date.strftime('%d %b %Y')}"
        except Exception:
            pass

    # 2. Daily resolution
    if period_lower == "daily":
        target = None
        if target_date_str and target_date_str.strip():
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d %b %Y", "%d %B %Y"):
                try:
                    target = datetime.strptime(target_date_str.strip(), fmt).date()
                    break
                except Exception:
                    continue
        
        if not target:
            target = date.today()
            # If current day has no sales, check if there is an active sales date in database
            sales_exists = db.query(SalesData.id).filter(SalesData.date == target).first()
            if not sales_exists:
                latest_date = db.query(func.max(SalesData.date)).scalar()
                if latest_date:
                    target = latest_date

        start_date = target
        end_date = target
        title_label = f"Daily Register - {target.strftime('%d %B %Y')}"
        date_range_label = f"{target.strftime('%d %b %Y')} (Calculation Date: {target.strftime('%Y-%m-%d')})"
        return start_date, end_date, title_label, date_range_label

    # 3. Weekly resolution (last 7 days)
    if period_lower == "weekly":
        end_date = date.today()
        # Fallback to latest sales date if today has no activity
        latest_date = db.query(func.max(SalesData.date)).scalar()
        if latest_date and latest_date < end_date:
            sales_count_today = db.query(SalesData.id).filter(SalesData.date == end_date).first()
            if not sales_count_today:
                end_date = latest_date
        start_date = end_date - timedelta(days=6)
        title_label = f"Weekly Business Briefing ({start_date.strftime('%d %b')} - {end_date.strftime('%d %b %Y')})"
        date_range_label = f"{start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')} (7 Days)"
        return start_date, end_date, title_label, date_range_label

    # 4. Monthly resolution (Month-to-Date or Full Month)
    end_date = date.today()
    latest_date = db.query(func.max(SalesData.date)).scalar()
    if latest_date and latest_date < end_date:
        sales_count_today = db.query(SalesData.id).filter(SalesData.date == end_date).first()
        if not sales_count_today:
            end_date = latest_date
    start_date = end_date.replace(day=1)
    title_label = f"Monthly Executive Audit - {end_date.strftime('%B %Y')}"
    date_range_label = f"{start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')} (Month-to-Date)"
    return start_date, end_date, title_label, date_range_label


def generate_pdf_report(
    db: Session,
    period: str = "daily",
    period_label: str = "",
    target_date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> str:
    """
    Generates a production-grade PDF business intelligence report.
    - Synchronized with live PostgreSQL products, sales_data, and bills.
    - Guarantees explicit calculation dates applied consistently.
    - Matches /api/health/score and /api/inventory/summary exactly.
    - Renders graceful 'No data available' banners if records are missing.
    - Prevents orphaned headings with keepWithNext=True.
    """
    _ensure_reports_dir()

    # ── 1. Date Resolution ──
    # Check if period_label contains an explicit date string
    param_target = target_date
    if not param_target and period_label and any(c.isdigit() for c in period_label):
        # Could be "2026-10-15" or similar
        param_target = period_label

    calc_start, calc_end, title_label, date_range_label = resolve_report_dates(
        db=db,
        period=period,
        target_date_str=param_target,
        start_date_str=start_date,
        end_date_str=end_date
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean_period = period.strip().lower() if period else "daily"
    filename = f"businessgpt_report_{clean_period}_{timestamp}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    # Printable width: 595.27 - 72 = 523.27 pt
    PAGE_WIDTH = 523.27
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.6 * inch
    )

    styles = getSampleStyleSheet()

    # ── Color Palette ──
    PRIMARY = colors.HexColor("#4F46E5")     # Indigo
    PRIMARY_DARK = colors.HexColor("#312E81")
    PRIMARY_LIGHT = colors.HexColor("#EEF2FF")
    ACCENT = colors.HexColor("#10B981")      # Emerald
    ACCENT_LIGHT = colors.HexColor("#ECFDF5")
    WARNING = colors.HexColor("#F59E0B")     # Amber
    WARNING_LIGHT = colors.HexColor("#FFFBEB")
    DANGER = colors.HexColor("#EF4444")      # Rose
    DANGER_LIGHT = colors.HexColor("#FEF2F2")
    TEXT_DARK = colors.HexColor("#111827")
    TEXT_MUTED = colors.HexColor("#4B5563")
    BG_MUTED = colors.HexColor("#F9FAFB")
    BORDER_COLOR = colors.HexColor("#E5E7EB")

    # ── Typography Styles ──
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=PRIMARY_DARK,
        alignment=TA_CENTER,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=PRIMARY,
        alignment=TA_CENTER,
        spaceAfter=3
    )

    meta_style = ParagraphStyle(
        "CoverMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=PRIMARY_DARK,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=TEXT_DARK,
        spaceAfter=3
    )

    body_bold = ParagraphStyle(
        "ReportBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold"
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=TEXT_DARK
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=table_cell_style,
        fontName="Helvetica-Bold"
    )

    table_cell_right = ParagraphStyle(
        "TableCellRight",
        parent=table_cell_style,
        alignment=TA_RIGHT
    )

    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        parent=table_cell_style,
        alignment=TA_CENTER
    )

    badge_danger = ParagraphStyle(
        "BadgeDanger",
        parent=table_cell_center,
        fontName="Helvetica-Bold",
        textColor=DANGER
    )

    badge_warning = ParagraphStyle(
        "BadgeWarning",
        parent=table_cell_center,
        fontName="Helvetica-Bold",
        textColor=WARNING
    )

    badge_success = ParagraphStyle(
        "BadgeSuccess",
        parent=table_cell_center,
        fontName="Helvetica-Bold",
        textColor=ACCENT
    )

    empty_box_style = ParagraphStyle(
        "EmptyBox",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=13,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER
    )

    story = []

    # ══════════════════════════════════════════════════════════════
    # ── HEADER & COVER BANNER ──
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("BusinessGPT Intelligence", title_style))
    story.append(Paragraph(title_label, subtitle_style))
    meta_text = (
        f"<b>Calculation Period:</b> {date_range_label} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Generated:</b> {datetime.now().strftime('%d %b %Y, %I:%M %p')}"
    )
    story.append(Paragraph(meta_text, meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceAfter=8, spaceBefore=0))

    # ══════════════════════════════════════════════════════════════
    # ── 1. BUSINESS HEALTH SCORE (Identical to /api/health/score) ──
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Business Health Score", h2_style))
    try:
        health = compute_health_score(db)
        score = health.get("total_score")
        grade = health.get("grade", "N/A")
        status = health.get("status", "unknown")
        components = health.get("components", {})
        message = health.get("message", "")
        top_issue = health.get("top_issue", "")

        if score is None or status == "no_data":
            # Genuinely empty sales data
            no_health_table = [
                [Paragraph(
                    "<b>No Health Score Available:</b> Sales data has not been logged or uploaded yet.<br/>"
                    "Register POS transactions or upload historical sales records to calculate business health.",
                    empty_box_style
                )]
            ]
            t_no_health = Table(no_health_table, colWidths=[PAGE_WIDTH])
            t_no_health.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))
            story.append(t_no_health)
        else:
            # Score banner text
            grade_color_hex = "#10B981" if score >= 75 else ("#F59E0B" if score >= 50 else "#EF4444")
            score_desc = f"Overall Score: <b>{score}/100</b> &nbsp;|&nbsp; Grade: <b>{grade}</b> ({health.get('trend', 'stable').capitalize()})"
            story.append(Paragraph(score_desc, body_bold))
            if top_issue:
                story.append(Paragraph(f"<b>Primary Store Diagnosis:</b> {top_issue}", body_style))

            # Components Breakdown Table
            comp_headers = [
                Paragraph("Health Dimension", table_header_style),
                Paragraph("Score", table_header_style),
                Paragraph("Maximum", table_header_style),
                Paragraph("Performance Status / Benchmark", table_header_style),
            ]

            max_map = {"revenue": 30, "inventory": 25, "sales_trend": 25, "product_diversity": 20}
            comp_details = health.get("component_details", {})
            
            # Sub-status text
            rev_detail = comp_details.get("revenue", {})
            trend_detail = comp_details.get("sales_trend", {})
            div_detail = comp_details.get("product_diversity", {})

            notes_map = {
                "revenue": f"Target pace: {rev_detail.get('pct_of_target', 100)}% of benchmark" if rev_detail else "Evaluated against monthly targets",
                "inventory": f"Stock health ratio evaluated across catalog",
                "sales_trend": f"Trajectory: {trend_detail.get('trend', 'stable').capitalize()} ({trend_detail.get('change_pct', 0):+}% change)" if trend_detail else "Historical month-over-month trajectory",
                "product_diversity": f"Concentration: Top product contributes {div_detail.get('top_product_revenue_pct', 0)}%" if div_detail else "Product revenue concentration",
            }

            rows = [comp_headers]
            for k in ["revenue", "inventory", "sales_trend", "product_diversity"]:
                c_score = components.get(k, 0)
                c_max = max_map.get(k, 25)
                c_title = k.replace("_", " ").title()
                c_note = notes_map.get(k, "Normal")
                rows.append([
                    Paragraph(f"<b>{c_title}</b>", table_cell_style),
                    Paragraph(f"<b>{c_score}</b>", table_cell_center),
                    Paragraph(str(c_max), table_cell_center),
                    Paragraph(c_note, table_cell_style),
                ])

            t_health = Table(rows, colWidths=[130, 50, 55, PAGE_WIDTH - 235])
            t_health.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_MUTED]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(t_health)

    except Exception as e:
        story.append(Paragraph(f"Health score computation notice: {str(e)[:100]}", body_style))

    story.append(Spacer(1, 6))

    # ══════════════════════════════════════════════════════════════
    # ── 2. SALES PERFORMANCE (Authoritative PostgreSQL Sales & POS) ──
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Sales Performance", h2_style))

    # Query live SalesData for the exact report period
    sales_query = db.query(SalesData).filter(
        SalesData.date >= calc_start,
        SalesData.date <= calc_end
    )
    sales_rows = sales_query.all()

    # Query live Bills for the exact report period
    bills_query = db.query(Bill).filter(
        func.date(Bill.created_at) >= calc_start,
        func.date(Bill.created_at) <= calc_end
    )
    bills_rows = bills_query.all()

    if not sales_rows and not bills_rows:
        # Check fallback to uploaded Dataset if database has no records
        latest_dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()
        dataset_handled = False
        if latest_dataset and latest_dataset.data:
            try:
                import pandas as pd
                from app.modules.inventory.router import _detect_col
                df_ds = pd.DataFrame(latest_dataset.data)
                cols = list(df_ds.columns)
                d_col = _detect_col(cols, ["date", "order_date", "invoice_date", "month", "time"])
                s_col = _detect_col(cols, ["sales", "revenue", "amount", "quantity", "units"])
                p_col = _detect_col(cols, ["product_name", "product", "item", "sku", "category"])
                if d_col and s_col:
                    df_ds[d_col] = pd.to_datetime(df_ds[d_col], errors="coerce").dt.date
                    df_ds[s_col] = pd.to_numeric(df_ds[s_col], errors="coerce").fillna(0)
                    df_filtered = df_ds[(df_ds[d_col] >= calc_start) & (df_ds[d_col] <= calc_end)]
                    if not df_filtered.empty:
                        dataset_handled = True
                        tot_rev = float(df_filtered[s_col].sum())
                        tot_units = int(df_filtered[s_col].count())
                        story.append(Paragraph(f"Sales Data Source: Uploaded Dataset ({latest_dataset.filename})", body_style))
                        story.append(Paragraph(f"Total Sales: <b>INR {tot_rev:,.2f}</b> | Records: <b>{tot_units}</b>", body_style))
            except Exception:
                dataset_handled = False

        if not dataset_handled:
            # Display clear, explicit 'No data available' banner
            no_sales_table = [
                [Paragraph(
                    f"<b>No Sales Data Available for this Period:</b> {calc_start.strftime('%d %b %Y')} to {calc_end.strftime('%d %b %Y')}.<br/>"
                    "No transactions, register receipts, or sales rows were recorded during this timeframe.",
                    empty_box_style
                )]
            ]
            t_no_sales = Table(no_sales_table, colWidths=[PAGE_WIDTH])
            t_no_sales.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]))
            story.append(t_no_sales)
    else:
        # Populate live aggregated sales metrics
        total_rev = sum(float(s.revenue or 0) for s in sales_rows)
        total_cost = sum(float(s.cost or 0) for s in sales_rows)
        total_profit = total_rev - total_cost
        margin_pct = (total_profit / total_rev * 100) if total_rev > 0 else 0.0
        total_units = sum(int(s.quantity_sold or 0) for s in sales_rows)
        bill_count = len(bills_rows)
        avg_bill = (total_rev / bill_count) if bill_count > 0 else 0.0

        # KPI Metrics Table (2x4 or 1x4 Grid)
        kpi_data = [
            [
                Paragraph("Gross Revenue", table_header_style),
                Paragraph("Gross Profit", table_header_style),
                Paragraph("Units Sold", table_header_style),
                Paragraph("Transactions / Bills", table_header_style),
            ],
            [
                Paragraph(f"<b>INR {total_rev:,.2f}</b>", table_cell_center),
                Paragraph(f"<b>INR {total_profit:,.2f}</b><br/><font color='#10B981' size='7'>({margin_pct:.1f}% Margin)</font>", table_cell_center),
                Paragraph(f"<b>{total_units:,}</b> items", table_cell_center),
                Paragraph(f"<b>{bill_count}</b> bills<br/><font color='#6B7280' size='7'>(Avg: INR {avg_bill:,.0f})</font>", table_cell_center),
            ]
        ]
        col_w = PAGE_WIDTH / 4.0
        t_kpi = Table(kpi_data, colWidths=[col_w, col_w, col_w, col_w])
        t_kpi.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_DARK),
            ("BACKGROUND", (0, 1), (-1, 1), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 5))

        # Top Performing Products in this Period
        # Fetch product metadata from live products table
        all_products = {p.id: p for p in db.query(Product).all()}
        prod_agg = {}
        for s in sales_rows:
            p_id = s.product_id
            if p_id not in prod_agg:
                prod_agg[p_id] = {"units": 0, "rev": 0.0, "cost": 0.0}
            prod_agg[p_id]["units"] += (s.quantity_sold or 0)
            prod_agg[p_id]["rev"] += float(s.revenue or 0.0)
            prod_agg[p_id]["cost"] += float(s.cost or 0.0)

        # Sort by revenue descending
        top_sorted = sorted(prod_agg.items(), key=lambda x: x[1]["rev"], reverse=True)[:5]
        if top_sorted:
            story.append(Paragraph("<b>Top Products by Revenue (This Period):</b>", body_style))
            top_rows = [
                [
                    Paragraph("Product Name", table_header_style),
                    Paragraph("Category", table_header_style),
                    Paragraph("Units Sold", table_header_style),
                    Paragraph("Revenue", table_header_style),
                    Paragraph("Profit", table_header_style),
                    Paragraph("Margin", table_header_style),
                ]
            ]
            for p_id, stats in top_sorted:
                p_obj = all_products.get(p_id)
                p_name = p_obj.name if p_obj else f"Product #{p_id}"
                p_cat = p_obj.category if p_obj else "General"
                p_prof = stats["rev"] - stats["cost"]
                p_margin = (p_prof / stats["rev"] * 100) if stats["rev"] > 0 else 0.0

                top_rows.append([
                    Paragraph(p_name, table_cell_style),
                    Paragraph(p_cat, table_cell_style),
                    Paragraph(str(stats["units"]), table_cell_center),
                    Paragraph(f"INR {stats['rev']:,.2f}", table_cell_right),
                    Paragraph(f"INR {p_prof:,.2f}", table_cell_right),
                    Paragraph(f"{p_margin:.1f}%", table_cell_center),
                ])

            t_top = Table(top_rows, colWidths=[150, 95, 60, 80, 80, PAGE_WIDTH - 465])
            t_top.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_MUTED]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]))
            story.append(t_top)
            story.append(Spacer(1, 5))

        # Daily / Historical Context Trend Table
        # For daily report: Show recent 7 active days up to target day so the manager gets daily context
        # For weekly/monthly report: Show daily breakdown within the period
        if clean_period == "daily":
            trend_start = calc_end - timedelta(days=6)
            trend_end = calc_end
            trend_title = f"<b>Recent 7-Day Performance Trend (Ending {calc_end.strftime('%d %b %Y')}):</b>"
        else:
            trend_start = calc_start
            trend_end = calc_end
            trend_title = f"<b>Daily Performance Breakdown ({calc_start.strftime('%d %b')} - {calc_end.strftime('%d %b %Y')}):</b>"

        trend_query = db.query(
            SalesData.date,
            func.sum(SalesData.quantity_sold).label("units"),
            func.sum(SalesData.revenue).label("rev"),
            func.sum(SalesData.cost).label("cost")
        ).filter(
            SalesData.date >= trend_start,
            SalesData.date <= trend_end
        ).group_by(SalesData.date).order_by(SalesData.date.desc()).all()

        if trend_query:
            story.append(Paragraph(trend_title, body_style))
            trend_rows = [
                [
                    Paragraph("Date", table_header_style),
                    Paragraph("Units Sold", table_header_style),
                    Paragraph("Daily Revenue", table_header_style),
                    Paragraph("Gross Profit", table_header_style),
                    Paragraph("Gross Margin", table_header_style),
                ]
            ]
            for row in trend_query:
                r_date = row.date.strftime("%d %b %Y") if hasattr(row.date, "strftime") else str(row.date)
                r_units = int(row.units or 0)
                r_rev = float(row.rev or 0.0)
                r_cost = float(row.cost or 0.0)
                r_prof = r_rev - r_cost
                r_margin = (r_prof / r_rev * 100) if r_rev > 0 else 0.0
                
                # Highlight current calculation date row
                is_target = (hasattr(row.date, "strftime") and row.date == calc_end)

                if is_target:
                    trend_rows.append([
                        Paragraph(f"<b>{r_date} (Report Day)</b>", table_cell_style),
                        Paragraph(f"<b>{r_units:,}</b>", table_cell_center),
                        Paragraph(f"<b>INR {r_rev:,.2f}</b>", table_cell_right),
                        Paragraph(f"<b>INR {r_prof:,.2f}</b>", table_cell_right),
                        Paragraph(f"<b>{r_margin:.1f}%</b>", table_cell_center),
                    ])
                else:
                    trend_rows.append([
                        Paragraph(r_date, table_cell_style),
                        Paragraph(f"{r_units:,}", table_cell_center),
                        Paragraph(f"INR {r_rev:,.2f}", table_cell_right),
                        Paragraph(f"INR {r_prof:,.2f}", table_cell_right),
                        Paragraph(f"{r_margin:.1f}%", table_cell_center),
                    ])

            t_trend = Table(trend_rows, colWidths=[140, 75, 110, 110, PAGE_WIDTH - 435])
            t_trend.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_MUTED]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]))
            story.append(t_trend)

    story.append(Spacer(1, 6))

    # ══════════════════════════════════════════════════════════════
    # ── 3. INVENTORY STATUS (Authoritative Live PostgreSQL Products) ──
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("3. Inventory Status & Health", h2_style))

    # Authoritative live products table
    products = db.query(Product).order_by(Product.name.asc()).all()

    if not products:
        no_inv_table = [
            [Paragraph(
                "<b>No Inventory Records Available:</b> The live catalog is currently empty.<br/>"
                "Add products or import catalog data to enable inventory valuation and automated stock health monitoring.",
                empty_box_style
            )]
        ]
        t_no_inv = Table(no_inv_table, colWidths=[PAGE_WIDTH])
        t_no_inv.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_MUTED),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(t_no_inv)
    else:
        # Compute exact inventory metrics matching /api/inventory/summary
        total_products_count = len(products)
        total_valuation = sum(float(p.current_stock or 0) * float(p.unit_price or 0.0) for p in products)
        
        critical_items = []
        low_items = []
        optimal_count = 0
        overstock_count = 0

        for p in products:
            stat = compute_stock_status(p.current_stock, p.reorder_point)
            if stat == "CRITICAL":
                critical_items.append(p)
            elif stat == "LOW":
                low_items.append(p)
            elif stat == "OVERSTOCK":
                overstock_count += 1
            else:
                optimal_count += 1

        total_reorder_needed = len(critical_items) + len(low_items)

        # Inventory KPI Summary Bar
        inv_summary_data = [
            [
                Paragraph("Catalog SKUs", table_header_style),
                Paragraph("Total Stock Value", table_header_style),
                Paragraph("Optimal Stock", table_header_style),
                Paragraph("Low / Critical Stock", table_header_style),
            ],
            [
                Paragraph(f"<b>{total_products_count}</b> items", table_cell_center),
                Paragraph(f"<b>INR {total_valuation:,.2f}</b>", table_cell_center),
                Paragraph(f"<font color='#10B981'><b>{optimal_count}</b> optimal</font>", table_cell_center),
                Paragraph(f"<font color='#EF4444'><b>{total_reorder_needed}</b> need reorder</font>", table_cell_center),
            ]
        ]
        col_w = PAGE_WIDTH / 4.0
        t_inv_kpi = Table(inv_summary_data, colWidths=[col_w, col_w, col_w, col_w])
        t_inv_kpi.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_DARK),
            ("BACKGROUND", (0, 1), (-1, 1), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_inv_kpi)
        story.append(Spacer(1, 5))

        # Real-time Reorder Alerts Table (Strictly from live stock and reorder points)
        alert_items = critical_items + low_items
        if alert_items:
            story.append(Paragraph(
                f"<b>Action Required: {len(alert_items)} Products at or below Reorder Threshold</b>",
                body_bold
            ))
            inv_table_rows = [
                [
                    Paragraph("Product Name", table_header_style),
                    Paragraph("Category", table_header_style),
                    Paragraph("Current Stock", table_header_style),
                    Paragraph("Reorder Level", table_header_style),
                    Paragraph("Unit Price", table_header_style),
                    Paragraph("Status", table_header_style),
                    Paragraph("Suggested Order", table_header_style),
                ]
            ]

            for p in alert_items:
                stat = compute_stock_status(p.current_stock, p.reorder_point)
                badge_p = badge_danger if stat == "CRITICAL" else badge_warning
                suggested_reorder = max(p.reorder_point * 2 - p.current_stock, 5)

                inv_table_rows.append([
                    Paragraph(p.name, table_cell_style),
                    Paragraph(p.category or "General", table_cell_style),
                    Paragraph(f"<b>{p.current_stock}</b> {p.unit or 'pcs'}", table_cell_center),
                    Paragraph(f"{p.reorder_point} {p.unit or 'pcs'}", table_cell_center),
                    Paragraph(f"INR {p.unit_price:,.2f}", table_cell_right),
                    Paragraph(stat, badge_p),
                    Paragraph(f"+{suggested_reorder} {p.unit or 'pcs'}", table_cell_center),
                ])

            t_inv = Table(inv_table_rows, colWidths=[130, 85, 65, 65, 65, 50, PAGE_WIDTH - 460])
            t_inv.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), DANGER if critical_items else WARNING),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_MUTED]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]))
            story.append(t_inv)
        else:
            story.append(Paragraph(
                "<font color='#10B981'><b>[OK] Optimal Inventory:</b> All catalog products are stocked above reorder thresholds. No stockouts imminent.</font>",
                body_style
            ))

    story.append(Spacer(1, 6))

    # ══════════════════════════════════════════════════════════════
    # ── 4. STRATEGIC RECOMMENDATIONS & ACTION PLAN ──
    # ══════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Strategic Action Plan & Insights", h2_style))
    try:
        recs = []

        # 1. Inventory Priority
        if products:
            crit = [p for p in products if compute_stock_status(p.current_stock, p.reorder_point) == "CRITICAL"]
            low = [p for p in products if compute_stock_status(p.current_stock, p.reorder_point) == "LOW"]
            if crit:
                crit_names = ", ".join(f"{p.name} ({p.current_stock} left)" for p in crit[:2])
                recs.append(f"<b>Immediate Restock Required:</b> Expedite purchase orders for critical items: {crit_names}.")
            elif low:
                low_names = ", ".join(f"{p.name}" for p in low[:3])
                recs.append(f"<b>Inventory Replenishment:</b> Schedule reorders this week for: {low_names}.")
            else:
                recs.append("<b>Inventory Stability:</b> Stock levels are balanced. Maintain supplier cadence.")

        # 2. Upcoming Festival / Seasonal Opportunity
        fest_alerts = check_festival_alerts()
        if fest_alerts:
            recs.append(f"<b>Festival Demand Preparation:</b> {fest_alerts[0]['message']}")
        else:
            seasonal_opportunities = {
                1: "Republic Day sales + Winter clearance demand.",
                2: "Valentine's Day gifting & consumer goods surge.",
                3: "Holi festival supplies and FMCG grocery purchases.",
                4: "IPL season - snacks, beverages, and convenience items.",
                5: "Summer peak demand - cold beverages & cooling supplies.",
                6: "Monsoon onset - staple grains and comfort goods.",
                7: "Monsoon ongoing - maintain dry storage for grains.",
                8: "Independence Day + Raksha Bandhan gifting cycle.",
                9: "Navratri + Ganesh Chaturthi festive consumer demand.",
                10: "Diwali peak festival season - prime gross revenue window.",
                11: "Post-Diwali consolidation & winter essentials.",
                12: "Christmas + New Year holiday shopping wave.",
            }
            cur_month = calc_end.month
            recs.append(f"<b>Seasonal Horizon:</b> {seasonal_opportunities.get(cur_month, 'Regular operating cycle.')}")

        # 3. Margin & Operational Control
        recs.append(
            "<b>Margin & Audit Control:</b> Conduct routine weekly physical inventory counts "
            "and verify gross margins on top-selling items to prevent shrinkage."
        )

        for i, r in enumerate(recs, 1):
            story.append(Paragraph(f"{i}. {r}", body_style))

    except Exception:
        story.append(Paragraph("Strategic recommendations temporarily unavailable.", body_style))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=4))
    story.append(Paragraph(
        "Confidential - Prepared automatically by BusinessGPT Intelligence Engine for Store Management",
        ParagraphStyle("FooterNotice", parent=styles["Normal"], fontSize=7.5, textColor=colors.grey, alignment=TA_CENTER)
    ))

    # Build PDF with two-pass NumberedCanvas for dynamic page numbering
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[ReportsGenerator] PDF report generated successfully at: {os.path.abspath(filepath)}")
    return filepath
