import re

MAX_MSG_LEN = 1000   # WhatsApp single message limit for readability


def clean_html(text: str) -> str:
    """Remove any HTML tags from AI response."""
    return re.sub(r'<[^>]+>', '', text)


def format_for_whatsapp(text: str) -> str:
    """
    Converts a typical AI text response into WhatsApp-friendly plain text.
    - Strips HTML
    - Converts **bold** → *bold* (WhatsApp markdown)
    - Converts markdown headers (##) → plain text with emoji
    - Preserves emojis
    """
    text = clean_html(text)

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
        date = p.get('ds', '')[-5:] if p.get('ds') else ''
        val = round(p.get('yhat', 0))
        lines.append(f"  {date}: *{val}* units")

    if forecast_data.get('narrative'):
        lines.append(f"\n💡 {forecast_data['narrative'][:200]}")

    return '\n'.join(lines)


def format_low_stock(inv_data: dict) -> str:
    analysis = inv_data.get('analysis', [])
    low = [a for a in analysis if a.get('status') in ('CRITICAL', 'LOW_STOCK') and 'error' not in a]

    if not low:
        return "✅ Sab products ka stock theek hai!"

    lines = [f"📦 *Low Stock Alert — {len(low)} product{'s' if len(low) > 1 else ''}*", ""]
    for item in low[:8]:
        emoji = "🚨" if item['status'] == 'CRITICAL' else "⚠️"
        lines.append(f"{emoji} *{item['product']}*")
        lines.append(f"   Stock: {item.get('current_stock', '?')} | {item.get('days_remaining', '?')} din bache")

    return '\n'.join(lines)


def format_welcome(phone: str) -> str:
    return (
        "🤖 *BusinessGPT mein aapka swagat hai!*\n\n"
        "Main aapka AI Business Intelligence assistant hoon.\n\n"
        "📋 *Available Commands:*\n"
        "/health  → Business Health Score\n"
        "/alerts  → Pending Alerts\n"
        "/forecast → Sales Forecast\n"
        "/stock   → Low Stock Items\n"
        "/report  → Business Report\n\n"
        "Ya koi bhi sawaal poochho Hindi/English mein! 🙏"
    )
