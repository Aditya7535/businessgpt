import re
from typing import Optional, List, Dict, Any

MAX_MSG_LEN = 1200   # WhatsApp single message limit for readability


def clean_html(text: str) -> str:
    """Remove any HTML tags from AI response."""
    return re.sub(r'<[^>]+>', '', text)


def format_for_whatsapp(text: str) -> str:
    """
    Converts a typical AI text response into WhatsApp-friendly plain text.
    - Strips HTML
    - Strips raw SQL queries, technical execution notes, and internal system paths
    - Converts **bold** → *bold* (WhatsApp markdown)
    - Converts markdown headers (##) → plain text with emoji
    - Preserves emojis
    """
    text = clean_html(text)

    # Strip SQL code blocks ```sql ... ```
    text = re.sub(r'```(?:sql)?\s*[\s\S]*?```', '', text, flags=re.IGNORECASE)

    # Strip raw SQL statements (e.g. `SELECT ... FROM ...`)
    text = re.sub(r'`\s*SELECT\b[\s\S]*?`', '', text, flags=re.IGNORECASE)
    text = re.sub(r'(?:Query|SQL):\s*`?[^`\n]+`?', '', text, flags=re.IGNORECASE)

    # Strip internal technical source mentions
    text = re.sub(r'\*?Data Source:\s*[^\n]+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[Text-to-SQL\][^\n]+', '', text)

    # **bold** → *bold*
    text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', text)

    # ### Heading → 📌 Heading
    text = re.sub(r'###\s*(.+)', r'📌 *\1*', text)
    text = re.sub(r'##\s*(.+)', r'📌 *\1*', text)
    text = re.sub(r'#\s*(.+)', r'📌 *\1*', text)

    # Markdown lists → emoji bullets
    text = re.sub(r'^\s*[-*]\s+', '• ', text, flags=re.MULTILINE)

    # Remove excessive blank lines (max 2 newlines in a row)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def split_long_message(text: str, max_len: int = MAX_MSG_LEN) -> list[str]:
    """
    Splits a message longer than max_len into multiple chunks,
    splitting at sentence/newline boundaries when possible.
    """
    if len(text) <= max_len:
        return [text]

    chunks = []
    while len(text) > max_len:
        # Try to cut at last newline within limit
        cut = text.rfind('\n', 0, max_len)
        if cut == -1:
            # Try last sentence boundary
            cut = text.rfind('. ', 0, max_len)
        if cut == -1:
            cut = max_len

        chunks.append(text[:cut].strip())
        text = text[cut:].strip()

    if text:
        chunks.append(text)

    return chunks


def format_health_score(health: dict) -> str:
    score = health.get('total_score', 0)
    grade = health.get('grade', 'N/A')
    comps = health.get('components', {})
    msg = health.get('message', '')

    lines = [
        f"📊 *Business Health Score*",
        f"Score: *{score}/100* — Grade *{grade}*",
        "",
        msg,
        "",
        "Component Breakdown:",
        f"  💰 Revenue:        {comps.get('revenue', 0)}/30",
        f"  📦 Inventory:      {comps.get('inventory', 0)}/25",
        f"  📈 Sales Trend:    {comps.get('sales_trend', 0)}/25",
        f"  🛒 Diversity:      {comps.get('product_diversity', 0)}/20",
    ]
    return '\n'.join(lines)


def format_alerts(alerts: list) -> str:
    if not alerts:
        return "✅ Koi pending alerts nahi hain. Sab theek hai!"

    severity_emoji = {'HIGH': '🚨', 'MEDIUM': '⚠️', 'LOW': 'ℹ️'}
    lines = [f"🔔 *{len(alerts)} Pending Alert{'s' if len(alerts) > 1 else ''}*", ""]
    for a in alerts[:5]:
        emoji = severity_emoji.get(a.get('severity', 'LOW'), '•')
        lines.append(f"{emoji} {a.get('message', '')}")

    if len(alerts) > 5:
        lines.append(f"\n...aur {len(alerts) - 5} aur alerts hain.")

    return '\n'.join(lines)


def format_forecast(forecast_data: dict) -> str:
    if not forecast_data or not forecast_data.get('forecast'):
        return "⚠️ Forecast ke liye pehle data upload karein."

    points = forecast_data['forecast'][:7]
    lines = [
        f"📈 *Sales Forecast*",
        f"Model: {forecast_data.get('model_used', 'AI')}",
        f"Next week predictions:",
        "",
    ]
    for p in points:
        date = p.get('date', '')[-5:] if p.get('date') else p.get('ds', '')[-5:]
        val = round(p.get('predicted', p.get('yhat', 0)))
        lines.append(f"  {date}: *{val}* units")

    if forecast_data.get('insights'):
        lines.append(f"\n💡 {forecast_data['insights'][:200]}")

    return '\n'.join(lines)


def format_low_stock(inv_data: dict) -> str:
    critical = inv_data.get('critical', [])
    low = inv_data.get('low_stock', [])

    if not critical and not low:
        return "✅ Sab products ka stock healthy hai! Koi shortage nahi hai."

    lines = [f"📦 *Inventory Alerts*", ""]
    if critical:
        lines.append(f"🚨 *CRITICAL (Urgent Reorder Needed - {len(critical)} Items)*")
        for item in critical[:5]:
            lines.append(f"• *{item.get('name', 'Product')}*: {item.get('current_stock', 0)} {item.get('unit', 'units')} left (Reorder point: {item.get('reorder_point', 0)})")
        lines.append("")

    if low:
        lines.append(f"⚠️ *LOW STOCK ({len(low)} Items)*")
        for item in low[:5]:
            lines.append(f"• *{item.get('name', 'Product')}*: {item.get('current_stock', 0)} {item.get('unit', 'units')} left")

    return '\n'.join(lines)


def format_welcome(phone: str, user_name: Optional[str] = None) -> str:
    greeting = f"Namaste *{user_name}*!" if user_name else "Namaste!"
    return (
        f"🤖 *BusinessGPT AI Assistant — {greeting}*\n\n"
        "Main aapka intelligent AI business consultant hoon. Main live store sales, stock, aur seasonal demand analyze kar sakta hoon.\n\n"
        "📋 *Quick Commands:*\n"
        "• `/health`   → Business Health Score\n"
        "• `/alerts`   → Pending Warnings & Alerts\n"
        "• `/stock`    → Low & Critical Stock Items\n"
        "• `/forecast` → Sales Prediction\n"
        "• `/report`   → Latest Store PDF Report\n\n"
        "💬 Ya direct koi bhi sawal poochhein Hinglish mein, jaise:\n"
        "\"Aaj ki total sales kitni hui?\"\n"
        "\"Kaunse products reorder karne hain?\"\n"
        "\"Aane wale festival ke liye kya stock rakhein?\""
    )


def format_unlinked_onboarding(phone: str) -> str:
    return (
        f"👋 *Namaste! Main BusinessGPT hoon — aapka AI Business Consultant.*\n\n"
        f"Aapka yeh WhatsApp number (*{phone}*) abhi kisi BusinessGPT store account se linked nahi hai.\n\n"
        "🔒 *Store data security:* Aapke store ki sales aur inventory confidential hai, isliye yeh sirf verified owner/manager ko hi dikhayi jaati hai.\n\n"
        "📲 *Apna Store Account Link Kaise Karein:*\n"
        "1. BusinessGPT web dashboard kholein (Settings → WhatsApp).\n"
        "2. Apna number register karke 'Save' karein.\n"
        "3. Ya agar aap store owner hain, to direct reply karein:\n"
        "   *LINK <4-digit-PIN>* (e.g. `LINK 1111`)\n\n"
        "💡 *Tip:* General business advice aur market trends ('Aane wala festival konsa hai?' ya 'Diwali par FMCG strategy') aap bina account link kiye bhi pooch sakte hain!"
    )


def format_daily_digest(
    store_name: str,
    date_str: str,
    sales_info: dict,
    low_stock_count: int,
    critical_stock_count: int,
    health_score: Optional[int] = None,
    health_grade: Optional[str] = None,
    tip_or_seasonal: Optional[str] = None
) -> str:
    """Formats an authoritative morning business summary based strictly on actual database metrics."""
    rev = sales_info.get("revenue", 0.0)
    units = sales_info.get("units", 0)
    profit = sales_info.get("profit", 0.0)

    lines = [
        f"🌅 *BusinessGPT Morning Briefing*",
        f"🗓️ {date_str} | 🏪 *{store_name}*",
        "━━━━━━━━━━━━━━━━━━━━",
        "📈 *Sales Performance (Yesterday / Recent)*",
        f"• Total Revenue: *₹{rev:,.2f}*",
        f"• Units Sold: *{units:,} units*",
    ]
    if profit > 0:
        lines.append(f"• Estimated Profit: *₹{profit:,.2f}*")

    lines.append("")
    lines.append("📦 *Inventory Status*")
    if critical_stock_count > 0:
        lines.append(f"• 🚨 *{critical_stock_count} critical shortage(s)* below safety buffer!")
    if low_stock_count > 0:
        lines.append(f"• ⚠️ *{low_stock_count} item(s)* near reorder threshold.")
    if critical_stock_count == 0 and low_stock_count == 0:
        lines.append("• ✅ All stock levels currently above reorder points.")

    if health_score is not None:
        grade_str = f" (Grade {health_grade})" if health_grade else ""
        lines.append("")
        lines.append(f"🩺 *Store Health Score*: *{health_score}/100*{grade_str}")

    if tip_or_seasonal:
        lines.append("")
        lines.append(f"💡 *Consultant Tip*: {tip_or_seasonal}")

    lines.append("")
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("Reply to this message anytime to consult BusinessGPT! 🙏")

    return "\n".join(lines)
