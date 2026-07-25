from typing import List, Dict


# Points per status
STATUS_POINTS = {
    "OPTIMAL": 0,
    "LOW_STOCK": -10,
    "CRITICAL": -25,
    "OVERSTOCK": -5,
    "UNKNOWN": -5,
}

BASE_SCORE = 100


def compute_inventory_health_score(analyses: List[Dict]) -> Dict:
    """
    Computes the inventory component of the Business Health Score.

    Returns:
    {
        "score": 75,
        "max_score": 100,
        "grade": "B",
        "summary": "2 products low stock, 1 critical",
        "breakdown": {...}
    }
    """
    if not analyses:
        return {
            "score": 0,
            "max_score": BASE_SCORE,
            "grade": "N/A",
            "summary": "Koi inventory data nahi mila.",
            "breakdown": {}
        }

    total_deduction = 0
    breakdown = {
        "OPTIMAL": [],
        "LOW_STOCK": [],
        "CRITICAL": [],
        "OVERSTOCK": [],
    }

    for item in analyses:
        if "error" in item:
            continue
        status = item.get("status", "UNKNOWN")
        product = item.get("product", "Unknown")
        deduction = abs(STATUS_POINTS.get(status, -5))
        total_deduction += deduction

        if status in breakdown:
            breakdown[status].append(product)

    score = max(0, BASE_SCORE - total_deduction)

    # Grade
    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    # Summary in Hinglish
    parts = []
    if breakdown["CRITICAL"]:
        parts.append(f"{len(breakdown['CRITICAL'])} product(s) CRITICAL")
    if breakdown["LOW_STOCK"]:
        parts.append(f"{len(breakdown['LOW_STOCK'])} LOW_STOCK")
    if breakdown["OVERSTOCK"]:
        parts.append(f"{len(breakdown['OVERSTOCK'])} OVERSTOCK")
    if breakdown["OPTIMAL"]:
        parts.append(f"{len(breakdown['OPTIMAL'])} OPTIMAL")

    summary = ", ".join(parts) if parts else "Sab theek hai!"

    return {
        "score": score,
        "max_score": BASE_SCORE,
        "grade": grade,
        "summary": summary,
        "breakdown": breakdown,
    }


def get_inventory_alerts(analyses: List[Dict]) -> Dict:
    """
    Groups products into alert buckets.
    """
    alerts = {
        "critical": [],
        "low_stock": [],
        "overstock": [],
        "optimal": [],
    }

    for item in analyses:
        if "error" in item:
            continue
        status = item.get("status", "UNKNOWN")
        product = item.get("product", "?")
        days = item.get("days_remaining", 0)

        if status == "CRITICAL":
            alerts["critical"].append(f"{product} — sirf {int(days)} din mein khatam")
        elif status == "LOW_STOCK":
            alerts["low_stock"].append(f"{product} — {int(days)} din mein khatam")
        elif status == "OVERSTOCK":
            alerts["overstock"].append(f"{product} — {int(days)} din ka stock hai")
        else:
            alerts["optimal"].append(product)

    return alerts
