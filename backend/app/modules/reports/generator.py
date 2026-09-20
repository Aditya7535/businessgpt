import os
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session

from app.models.dataset import Dataset

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "reports")


def _ensure_reports_dir():
    os.makedirs(REPORTS_DIR, exist_ok=True)


def generate_pdf_report(db: Session, period: str = "monthly", period_label: str = "") -> str:
    """
    Generates a PDF business report and saves it to backend/data/reports/.
    Returns the absolute path to the generated PDF.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise ImportError("ReportLab not installed. Run: pip install reportlab")

    _ensure_reports_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"businessgpt_report_{period}_{timestamp}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    doc = SimpleDocTemplate(filepath, pagesize=A4,
                             rightMargin=0.75*inch, leftMargin=0.75*inch,
                             topMargin=0.75*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()
    BRAND_COLOR = colors.HexColor("#4F46E5")
    ACCENT_COLOR = colors.HexColor("#10B981")
    DANGER_COLOR = colors.HexColor("#EF4444")

    title_style = ParagraphStyle("Title", parent=styles["Heading1"],
                                  fontSize=22, textColor=BRAND_COLOR,
                                  spaceAfter=4, alignment=TA_CENTER)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"],
                               fontSize=14, textColor=BRAND_COLOR, spaceBefore=12, spaceAfter=4)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                 fontSize=10, leading=16, spaceAfter=4)
    caption_style = ParagraphStyle("Caption", parent=styles["Normal"],
                                    fontSize=8, textColor=colors.grey, alignment=TA_CENTER)

    story = []

    # ── Cover ──
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("🤖 BusinessGPT", title_style))
    story.append(Paragraph(f"{period.capitalize()} Business Intelligence Report", styles["Heading2"]))
    story.append(Paragraph(f"Period: {period_label or datetime.now().strftime('%B %Y')}", body_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}", caption_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_COLOR, spaceAfter=12))

    # ── 1. Health Score ──
    story.append(Paragraph("1. Business Health Score", h2_style))
    try:
        from app.modules.health.scorer import compute_health_score
        health = compute_health_score(db)
        score = health.get("total_score", 0)
        grade = health.get("grade", "N/A")
        components = health.get("components", {})

        story.append(Paragraph(f"<b>Overall Score: {score}/100 — Grade {grade}</b>", body_style))
        story.append(Paragraph(health.get("message", ""), body_style))
        story.append(Spacer(1, 0.1*inch))

        health_table_data = [["Component", "Score", "Max"]]
        for k, v in components.items():
            max_map = {"revenue": 30, "inventory": 25, "sales_trend": 25, "product_diversity": 20}
            health_table_data.append([k.replace("_", " ").title(), str(v), str(max_map.get(k, "?"))])

        t = Table(health_table_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ]))
        story.append(t)
    except Exception as e:
        story.append(Paragraph(f"Health score unavailable: {str(e)[:60]}", body_style))

    story.append(Spacer(1, 0.2*inch))

    # ── 2. Sales Performance ──
    story.append(Paragraph("2. Sales Performance", h2_style))
    try:
        import pandas as pd
        from app.modules.inventory.router import _detect_col

        latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if latest and latest.data:
            df = pd.DataFrame(latest.data)
            cols = list(df.columns)
            date_col = _detect_col(cols, ["date", "order_date", "invoice_date", "month", "time"])
            sales_col = _detect_col(cols, ["sales", "revenue", "amount", "quantity", "units"])
            product_col = _detect_col(cols, ["product_name", "product", "item", "sku", "category"])

            if date_col and sales_col:
                df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
                df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
                df = df.dropna(subset=[date_col])

                total_sales = df[sales_col].sum()
                avg_daily = df.groupby(df[date_col].dt.date)[sales_col].sum().mean()

                story.append(Paragraph(f"Total Sales: <b>{total_sales:,.0f}</b> units / revenue", body_style))
                story.append(Paragraph(f"Average Daily Sales: <b>{avg_daily:,.1f}</b>", body_style))
                story.append(Paragraph(f"Data File: {latest.filename} ({latest.row_count} rows)", body_style))

                # Top 5 products
                if product_col and product_col in df.columns:
                    top = df.groupby(product_col)[sales_col].sum().sort_values(ascending=False).head(5)
                    top_data = [["Product", "Total Sales"]]
                    for p, s in top.items():
                        top_data.append([str(p), f"{s:,.0f}"])
                    t = Table(top_data, colWidths=[4*inch, 2*inch])
                    t.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), ACCENT_COLOR),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ECFDF5")]),
                    ]))
                    story.append(Spacer(1, 0.1*inch))
                    story.append(Paragraph("<b>Top Products by Sales:</b>", body_style))
                    story.append(t)
    except Exception as e:
        story.append(Paragraph(f"Sales data unavailable: {str(e)[:60]}", body_style))

    story.append(Spacer(1, 0.2*inch))

    # ── 3. Inventory Status ──
    story.append(Paragraph("3. Inventory Status", h2_style))
    try:
        from app.modules.alerts.checker import check_inventory_alerts
        inv_alerts = check_inventory_alerts(db)
        if inv_alerts:
            for a in inv_alerts:
                color = DANGER_COLOR if a["severity"] == "HIGH" else colors.orange
                story.append(Paragraph(f"• {a['message']}", body_style))
        else:
            story.append(Paragraph("✅ Sab products ka stock optimal level par hai.", body_style))
    except Exception:
        story.append(Paragraph("Inventory data unavailable.", body_style))

    story.append(Spacer(1, 0.2*inch))

    # ── 4. Recommendations ──
    story.append(Paragraph("4. Top Recommendations", h2_style))
    try:
        recs = []
        from app.modules.alerts.checker import check_festival_alerts
        fest_alerts = check_festival_alerts()
        if fest_alerts:
            recs.append(f"🎉 Festival prep: {fest_alerts[0]['message']}")

        from app.modules.market_intel.trends import INDIAN_SEASONAL_OPPORTUNITIES
        month = datetime.now().month
        recs.append(f"📅 Seasonal: {INDIAN_SEASONAL_OPPORTUNITIES.get(month, 'Regular season')}")
        recs.append("📊 Regular har hafte inventory audit karein aur reorder points review karein.")

        for i, r in enumerate(recs[:3], 1):
            story.append(Paragraph(f"{i}. {r}", body_style))
    except Exception:
        story.append(Paragraph("Recommendations unavailable.", body_style))

    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph("Generated by BusinessGPT — AI-powered Business Intelligence for Indian SMEs",
                             caption_style))

    doc.build(story)
    return filepath
