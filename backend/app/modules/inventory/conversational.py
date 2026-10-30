import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.stock_transaction import StockTransaction
from app.models.store_setting import StoreSetting
from app.models.inventory_adjustment import PendingInventoryAdjustment
from app.models.user import User

logger = logging.getLogger("businessgpt.conversational_inventory")

# ── Supported Movement Types ──
MOVEMENT_TYPES = {
    "RESTOCK": {"multiplier": 1, "label_en": "Received", "label_hi": "Stock aaya", "label_mr": "Aala"},
    "SALE": {"multiplier": -1, "label_en": "Sold", "label_hi": "Bik gaye", "label_mr": "Vikle"},
    "DAMAGED": {"multiplier": -1, "label_en": "Damaged/Expired", "label_hi": "Kharab/Toot gaya", "label_mr": "Kharab/Phutle"},
    "RETURN_TO_SUPPLIER": {"multiplier": -1, "label_en": "Supplier Return", "label_hi": "Supplier ko wapas", "label_mr": "Supplier la parat"},
    "CUSTOMER_RETURN": {"multiplier": 1, "label_en": "Customer Return", "label_hi": "Customer ne wapas kiya", "label_mr": "Grahakane parat kele"},
    "CORRECTION": {"multiplier": 0, "label_en": "Stock Correction", "label_hi": "Physical count correction", "label_mr": "Physical count correction"},
}

CONFIRMATION_AFFIRMATIVE_WORDS = {
    "haan", "ha", "haa", "yes", "y", "confirm", "confirmed", "ok", "okay",
    "theek hai", "thik hai", "kar do", "update kar do", "save kar do",
    "sure", "proceed", "go ahead", "update", "save", "bilkul", "sahi hai",
    "ho", "kara", "thik ahe", "confirm kara", "update kara", "karun taka"
}

CONFIRMATION_NEGATIVE_WORDS = {
    "nahi", "nahin", "na", "no", "n", "cancel", "cancelled", "mat karo",
    "ruk jao", "cancel kar do", "don't", "dont", "stop", "abort",
    "nako", "rada kara", "cancel kara"
}

# Number word mapping for Hindi / Marathi / English
NUMBER_WORDS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5, "panch": 5,
    "chhah": 6, "chhe": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "dus": 10, "gyarah": 11, "barah": 12, "terah": 13, "chaudah": 14,
    "pandrah": 15, "solah": 16, "satrah": 17, "athaarah": 18, "unnis": 19,
    "bees": 20, "pachees": 25, "pachis": 25, "tees": 30, "chalis": 40,
    "pachas": 50, "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90,
    "sau": 100, "so": 100,
    # Marathi
    "dohn": 2, "teen": 3, "chaar": 4, "paach": 5, "saha": 6,
    "daha": 10, "vis": 20, "panchvis": 25, "tis": 30, "pannaas": 50,
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "fifteen": 15,
    "twenty": 20, "twenty-five": 25, "thirty": 30, "fifty": 50, "hundred": 100
}


def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', (text or '').lower().strip())


def is_confirmation_intent(text: str) -> Optional[bool]:
    """
    Returns True for confirmation, False for cancellation, None if neither.
    """
    clean = normalize_text(text).rstrip(".!?")
    if clean in CONFIRMATION_AFFIRMATIVE_WORDS or any(clean.startswith(w + " ") or clean.endswith(" " + w) for w in ["haan", "yes", "confirm", "ho"]):
        return True
    if clean in CONFIRMATION_NEGATIVE_WORDS or any(clean.startswith(w + " ") or clean.endswith(" " + w) for w in ["nahi", "no", "cancel", "nako"]):
        return False
    return None


def match_product(db: Session, store_id: int, query_term: str) -> Tuple[str, List[Product]]:
    """
    Finds matching products in the store's database.
    Returns:
    - ('exact', [product])
    - ('ambiguous', [candidates])
    - ('not_found', [])
    """
    clean_term = normalize_text(query_term)
    if not clean_term:
        return ("not_found", [])

    # Strip units/packaging words from query term
    clean_term = re.sub(r'\b(packet|packets|pkt|pkts|kilo|kg|ltr|litre|bottle|bottles|pieces|pcs|dabbi|dabba|che|cha|ka|ki|ke|la)\b', '', clean_term).strip()

    # 1. Exact Barcode / SKU match
    exact_code = db.query(Product).filter(
        (Product.sku.ilike(clean_term)) | (Product.barcode == clean_term)
    ).first()
    if exact_code:
        return ("exact", [exact_code])

    all_products = db.query(Product).all()

    # 2. Exact or substring Name Match
    exact_names = [p for p in all_products if p.name.lower() == clean_term]
    if len(exact_names) == 1:
        return ("exact", exact_names)

    # 3. Known Aliases Match
    alias_matches = []
    for p in all_products:
        if p.aliases:
            try:
                aliases_list = json.loads(p.aliases) if isinstance(p.aliases, str) else p.aliases
                for al in aliases_list:
                    al_clean = al.lower().strip()
                    if al_clean == clean_term or al_clean in clean_term or clean_term in al_clean:
                        alias_matches.append(p)
                        break
            except Exception:
                pass

    if len(alias_matches) == 1:
        return ("exact", alias_matches)
    elif len(alias_matches) > 1:
        # Check if one is a more precise match
        strict_alias = [p for p in alias_matches if clean_term in [a.lower() for a in json.loads(p.aliases or "[]")]]
        if len(strict_alias) == 1:
            return ("exact", strict_alias)
        return ("ambiguous", alias_matches)

    # 4. Partial / Substring name matches
    substring_matches = [p for p in all_products if clean_term in p.name.lower()]
    if len(substring_matches) == 1:
        return ("exact", substring_matches)
    elif len(substring_matches) > 1:
        return ("ambiguous", substring_matches)

    # 5. Token overlap match (e.g., "Good Day" matching "Good Day Butter Cookies")
    query_tokens = set(clean_term.split())
    scored = []
    for p in all_products:
        p_tokens = set(p.name.lower().split())
        overlap = len(query_tokens.intersection(p_tokens))
        if overlap > 0:
            scored.append((overlap, p))
    scored.sort(key=lambda x: x[0], reverse=True)

    if scored and scored[0][0] >= 1:
        top_score = scored[0][0]
        top_candidates = [p for score, p in scored if score == top_score]
        if len(top_candidates) == 1:
            return ("exact", top_candidates)
        return ("ambiguous", top_candidates)

    return ("not_found", [])


def extract_movements_rule_based(query: str, db: Session) -> Optional[List[Dict[str, Any]]]:
    """
    Fast rule-based extraction for common stock adjustment sentences in
    Hindi, Hinglish, Marathi, and English.
    Returns list of parsed movement dicts, or None if not an inventory statement.
    """
    q_norm = normalize_text(query)

    # Filter out pure questions, greetings, analytics, phone numbers, prices
    if any(q_norm.startswith(q) for q in ["kya", "kitna", "kitni", "kaise", "kisko", "what", "how", "when", "show", "batao", "dikhao", "predict", "forecast"]):
        return None
    if "?" in query:
        return None
    if re.search(r'\b(phone|mobile|call|contact|price|rate|mrp|cost|bhav|keemat)\b', q_norm) and not any(k in q_norm for k in ["stock", "maal", "inventory", "godown", "bik", "sold"]):
        return None

    # Detect movement keywords
    # 1. RESTOCK
    restock_patterns = [
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs|pieces)?\s*(.+?)\s*(?:ka stock aaya|stock aaya|godown se aaya|aaya hai|aaye|aayi|aala|aale|aali|add kar do|aur add kar|stock mein daal|add kara|receive hua|arrived|received|restocked)',
        r'(?:aaya|aaye|received|restock|add)\s*(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs)?\s*(.+)',
    ]
    # 2. SALE
    sale_patterns = [
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs|pieces)?\s*(.+?)\s*(?:bik gaye|bik gaya|bika|viklya|vikle|sell hue|sell hua|bech diya|sold out|sold)',
        r'(?:sell|sold|becha)\s*(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs)?\s*(.+)',
    ]
    # 3. DAMAGED / EXPIRED
    damaged_patterns = [
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs|pieces)?\s*(.+?)\s*(?:toot gayi|toot gaya|phutli|phutlya|kharab ho gaya|kharab zali|damage hua|damaged|expire ho gaya|expired)',
    ]
    # 4. SUPPLIER RETURN
    supp_return_patterns = [
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs|pieces)?\s*(.+?)\s*(?:supplier ko return|supplier ko wapas|supplier la parat|distributor ko wapas|returned to supplier)',
    ]
    # 5. CUSTOMER RETURN
    cust_return_patterns = [
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs|pieces)?\s*(.+?)\s*(?:customer ne wapas kiya|grahak ne wapas|customer return|grahakane parat|customer returned)',
    ]
    # 6. CORRECTION / PHYSICAL COUNT
    correction_patterns = [
        r'(?:physical count|stock count|actual stock|shillak|ginti)\s*(?:hai|is|ahet)?\s*(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs)?\s*(.+)?',
        r'(\d+|[a-zA-Z]+)\s*(packet|pkt|kilo|kg|ltr|litre|bottle|pcs)?\s*(.+?)\s*(?:physical count|shillak ahet|actual mein bacha hai)',
    ]

    movements = []

    def parse_qty(val: str) -> Optional[int]:
        val = val.strip().lower()
        if val.isdigit():
            return int(val)
        return NUMBER_WORDS.get(val, None)

    # Check clauses split by 'aur', 'and', 'ani', comma
    clauses = re.split(r'\b(?:aur|and|ani|,|\+)\b', q_norm)
    last_product = ""
    for clause in clauses:
        clause = clause.strip()
        if not clause:
            continue

        matched = False
        # Test in order of priority:
        for m_type, pattern_list in [
            ("DAMAGED", damaged_patterns),
            ("RETURN_TO_SUPPLIER", supp_return_patterns),
            ("CUSTOMER_RETURN", cust_return_patterns),
            ("CORRECTION", correction_patterns),
            ("SALE", sale_patterns),
            ("RESTOCK", restock_patterns),
        ]:
            for pat in pattern_list:
                match = re.search(pat, clause)
                if match:
                    groups = match.groups()
                    qty_str = groups[0]
                    unit_str = groups[1] or "pcs"
                    prod_str = groups[2] if len(groups) > 2 else ""

                    qty = parse_qty(qty_str)
                    if qty and qty > 0:
                        prod_clean = (prod_str or "").strip()
                        # If product term was empty or at the start, try to infer from clause or carry forward
                        if not prod_clean or len(prod_clean) < 2:
                            # Try remaining words
                            rem = re.sub(r'\b(\d+|packet|pkt|kilo|kg|ltr|bottle|bik|gaye|aaya|toot|gayi|supplier|return|sell|hue|sold)\b', '', clause).strip()
                            prod_clean = rem if len(rem) >= 2 else last_product
                        else:
                            last_product = prod_clean

                        if prod_clean:
                            last_product = prod_clean
                            movements.append({
                                "raw_product": prod_clean,
                                "movement_type": m_type,
                                "quantity": qty,
                                "unit": unit_str
                            })
                            matched = True
                            break
            if matched:
                break

    return movements if movements else None


def extract_movements_with_llm(query: str) -> Optional[List[Dict[str, Any]]]:
    """
    Uses Groq LLM with strict JSON schema to parse nuanced, multi-lingual
    natural language inventory statements (Hindi, Marathi, Hinglish, English).
    """
    prompt = f"""You are an expert NLP parser for an Indian SME Retail Inventory Assistant.
Analyze this statement from a shop owner in English, Hindi, Hinglish, or Marathi:
User statement: "{query}"

Determine if the statement is an INVENTORY ADJUSTMENT instruction.
Valid movement types:
- 'RESTOCK' : Goods received, purchase order arrival, inward from godown/supplier ("aaya", "aala", "stock aaya", "add kar do", "arrived", "received")
- 'SALE' : Items sold, sales count ("bik gaye", "sell hue", "vikle", "sold")
- 'DAMAGED' : Broken, expired, spoiled, wasted items ("toot gayi", "phutli", "kharab", "expired", "damaged")
- 'RETURN_TO_SUPPLIER' : Stock returned back to vendor/supplier/distributor ("supplier ko wapas", "supplier la parat")
- 'CUSTOMER_RETURN' : Items returned by customer into store stock ("customer ne wapas kiya", "customer return", "grahakane parat")
- 'CORRECTION' : Physical stock count verification ("physical count 45 hai", "actual stock is 45", "shillak ahet 45")

RULE 1: NOT an inventory adjustment if it is just a price question, greeting, general conversation, or mentions a phone number. In that case, return: {{"is_inventory_adjustment": false, "movements": []}}
RULE 2: Support multiple movements in one statement (e.g. "50 Maggi aayi aur 20 bik gaye").
RULE 3: Output strictly valid JSON.

JSON Schema:
{{
  "is_inventory_adjustment": true/false,
  "language": "english" | "hinglish" | "hindi" | "marathi",
  "movements": [
    {{
      "raw_product": "extracted product name or brand",
      "movement_type": "RESTOCK" | "SALE" | "DAMAGED" | "RETURN_TO_SUPPLIER" | "CUSTOMER_RETURN" | "CORRECTION",
      "quantity": integer > 0,
      "unit": "packet" | "kg" | "pcs" | "ltr" | "bottle" etc.
    }}
  ]
}}
"""
    try:
        from app.modules.orchestrator.llm import invoke_llm
        from langchain_core.messages import SystemMessage
        res = invoke_llm([SystemMessage(content=prompt)], temperature=0.0)
        content = res.content.strip()
        # Extract json object
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group(0))
            if data.get("is_inventory_adjustment") and data.get("movements"):
                return data["movements"]
    except Exception as e:
        logger.warning(f"LLM inventory parsing failed: {e}")
    return None


def parse_inventory_utterance(query: str, db: Session) -> Optional[List[Dict[str, Any]]]:
    """
    Hybrid parser: checks rule-based patterns first, falls back to LLM for complex syntax.
    """
    rule_res = extract_movements_rule_based(query, db)
    if rule_res:
        return rule_res

    # Try LLM
    llm_res = extract_movements_with_llm(query)
    if llm_res:
        return llm_res

    return None


def build_confirmation_summary(
    proposals: List[Dict[str, Any]],
    language: str = "hinglish"
) -> str:
    """
    Generates a clear, professional confirmation summary in the owner's language
    before any database updates are committed.
    """
    lines = ["📦 *Stock Adjustment Confirmation / स्टॉक सुधार की पुष्टि*\n"]

    for item in proposals:
        p_name = item["product_name"]
        p_unit = item["unit"]
        prev_st = item["previous_stock"]
        new_st = item["new_stock"]
        net = item["net_change"]
        sign = "+" if net > 0 else ""

        lines.append(f"• *{p_name}*:")
        for m in item["movements"]:
            m_type = m["movement_type"]
            m_qty = m["quantity"]
            lbl = MOVEMENT_TYPES.get(m_type, {}).get("label_en", m_type)
            if m_type == "RESTOCK":
                lines.append(f"  - Received: +{m_qty} {p_unit}")
            elif m_type == "SALE":
                lines.append(f"  - Sold: -{m_qty} {p_unit}")
            elif m_type == "DAMAGED":
                lines.append(f"  - Damaged: -{m_qty} {p_unit}")
            elif m_type == "RETURN_TO_SUPPLIER":
                lines.append(f"  - Supplier Return: -{m_qty} {p_unit}")
            elif m_type == "CUSTOMER_RETURN":
                lines.append(f"  - Customer Return: +{m_qty} {p_unit}")
            elif m_type == "CORRECTION":
                lines.append(f"  - Verified Count: {m_qty} {p_unit}")

        lines.append(f"  - *Net Change*: {sign}{net} {p_unit}")
        lines.append(f"  - Current Stock: *{prev_st} {p_unit}*")
        lines.append(f"  - Proposed New Stock: *{new_st} {p_unit}*\n")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("❓ *Kya main yeh stock update kar doon? / Should I update this stock?*")
    lines.append("Reply karein: *Haan* (Confirm) ya *Nahi* (Cancel)")

    return "\n".join(lines)



def generate_sku(db: Session, category: str) -> str:
    """Generates next sequential SKU for a new product."""
    cat_upper = (category or "").upper()
    prefix = "SNACK" if "SNACK" in cat_upper or "BISCUIT" in cat_upper else "GROC" if "GROC" in cat_upper or "GRAIN" in cat_upper else "BEV" if "BEV" in cat_upper or "DRINK" in cat_upper else "PROD"
    count = db.query(Product).filter(Product.sku.like(f"{prefix}-%")).count() + 1
    sku = f"{prefix}-{count:03d}"
    while db.query(Product).filter(Product.sku == sku).first():
        count += 1
        sku = f"{prefix}-{count:03d}"
    return sku


def parse_product_management_intent(query: str, db: Session, store_id: int) -> Optional[Dict[str, Any]]:
    """
    Parses conversational intents for:
    1. CREATE_PRODUCT (e.g. 'Naya product add karo: Parle Rusk, price 40, stock 30')
    2. UPDATE_PRICE (e.g. 'Maggi ka price 16 kar do')
    3. UPDATE_REORDER (e.g. 'Basmati rice ka reorder point 20 kar do')
    4. DELETE_PRODUCT (e.g. 'Parle Rusk delete kar do')
    5. CHECK_STOCK (e.g. 'Maggi ka kitna stock hai', 'Check stock of Fortune oil')
    """
    q_norm = normalize_text(query)

    # ── 1. CHECK STOCK INQUIRY ──
    check_m = re.search(r'(.+?)\s*(?:ka|ki|ke)?\s*(?:stock|kitna stock|bachta hai|kitna bacha|available)\s*(?:hai|kitna hai|check karo)?', q_norm)
    if check_m and any(w in q_norm for w in ["kitna", "kitne", "check stock", "stock status", "kitna bacha"]):
        raw_t = check_m.group(1).strip()
        raw_t = re.sub(r'\b(batao|dikhao|check|kripya|please)\b', '', raw_t).strip()
        if len(raw_t) >= 2:
            m_type, candidates = match_product(db, store_id, raw_t)
            if m_type == "exact" and len(candidates) == 1:
                return {"action": "CHECK_STOCK", "product": candidates[0]}
            elif m_type == "ambiguous":
                return {"action": "AMBIGUOUS", "term": raw_t, "candidates": candidates}

    # ── 2. CREATE PRODUCT ──
    create_m = re.search(r'(?:naya product|naya item|add new product|create product|new sku|product add karo|item add karo|add product)\s*(?:add karo|create karo|banao|register karo)?(?:\s*:)?\s*(.+)', q_norm)
    if create_m:
        rest = create_m.group(1).strip()
        price_m = re.search(r'(?:price|rate|mrp|rs|₹)\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)', rest) or re.search(r'(\d+(?:\.\d+)?)\s*(?:rupaye|rs|rupya)', rest)
        price = float(price_m.group(1)) if price_m else 0.0

        stock_m = re.search(r'(?:stock|qty|quantity|initial stock)\s*(?:is|=|:)?\s*(\d+)', rest) or re.search(r'(\d+)\s*(?:packet|pkts|pcs|units|kg|kilo|bottle|bottles)', rest)
        stock = int(stock_m.group(1)) if stock_m else 0

        reorder_m = re.search(r'(?:reorder|alert)\s*(?:point|level)?\s*(?:is|=|:)?\s*(\d+)', rest)
        reorder = int(reorder_m.group(1)) if reorder_m else 10

        cat_m = re.search(r'(?:category|varg)\s*(?:is|=|:)?\s*([a-zA-Z]+)', rest)
        category = cat_m.group(1).capitalize() if cat_m else ("Snacks" if any(w in rest for w in ["biscuit", "cookie", "chips", "rusk", "snack", "maggi", "noodles", "chocolate", "wafers"]) else "Grocery")

        unit = "kg" if any(w in rest for w in ["kg", "kilo"]) else "packets" if any(w in rest for w in ["packet", "pkt"]) else "bottles" if "bottle" in rest else "pcs"

        # Clean product name
        name_clean = rest
        for m in [price_m, stock_m, reorder_m, cat_m]:
            if m:
                name_clean = name_clean.replace(m.group(0), '')
        name_clean = re.sub(r'\b(price|rate|stock|qty|reorder|point|level|rupaye|rs|packet|pkts|category|with|and|aur|,|:|ki|ka|ke)', '', name_clean).strip()
        name_clean = ' '.join(name_clean.replace(',', ' ').split()).title()

        if len(name_clean) >= 2 and price > 0:
            sku = generate_sku(db, category)
            return {
                "action": "CREATE_PRODUCT",
                "product_data": {
                    "name": name_clean,
                    "sku": sku,
                    "unit_price": price,
                    "initial_stock": stock,
                    "reorder_point": reorder,
                    "category": category,
                    "unit": unit
                }
            }

    # ── 3. UPDATE PRICE ──
    price_up_m = re.search(r'(.+?)\s*(?:ka|ki|ke)?\s*(?:price|rate|kimat)\s*(?:badal kar|change karke|set karke|to)?\s*(\d+(?:\.\d+)?)\s*(?:kar do|karo|set karo|banao)', q_norm)
    if price_up_m:
        prod_term = price_up_m.group(1).strip()
        new_price = float(price_up_m.group(2))
        m_type, candidates = match_product(db, store_id, prod_term)
        if m_type == "exact" and len(candidates) == 1:
            p = candidates[0]
            return {
                "action": "UPDATE_PRODUCT",
                "product_id": p.id,
                "product_name": p.name,
                "product_sku": p.sku,
                "product_price": p.unit_price,
                "product_reorder": p.reorder_point,
                "product_unit": p.unit,
                "update_data": {
                    "product_id": p.id,
                    "new_price": new_price
                }
            }
        elif m_type == "ambiguous":
            return {"action": "AMBIGUOUS", "term": prod_term, "candidates": candidates}

    # ── 4. UPDATE REORDER POINT ──
    reorder_up_m = re.search(r'(.+?)\s*(?:ka|ki|ke)?\s*(?:reorder|alert)\s*(?:point|level)?\s*(?:to)?\s*(\d+)\s*(?:kar do|karo|set karo|banao)', q_norm)
    if reorder_up_m:
        prod_term = reorder_up_m.group(1).strip()
        new_reorder = int(reorder_up_m.group(2))
        m_type, candidates = match_product(db, store_id, prod_term)
        if m_type == "exact" and len(candidates) == 1:
            p = candidates[0]
            return {
                "action": "UPDATE_PRODUCT",
                "product_id": p.id,
                "product_name": p.name,
                "product_sku": p.sku,
                "product_price": p.unit_price,
                "product_reorder": p.reorder_point,
                "product_unit": p.unit,
                "update_data": {
                    "product_id": p.id,
                    "new_reorder": new_reorder
                }
            }
        elif m_type == "ambiguous":
            return {"action": "AMBIGUOUS", "term": prod_term, "candidates": candidates}

    # ── 5. DELETE PRODUCT ──
    del_m = re.search(r'(.+?)\s*(?:ko)?\s*(?:catalog se)?\s*(?:delete|remove|hata)\s*(?:kar do|karo|dena)', q_norm)
    if del_m:
        prod_term = del_m.group(1).strip()
        if prod_term not in ["product", "item", "isko", "ye", "yeh"]:
            m_type, candidates = match_product(db, store_id, prod_term)
            if m_type == "exact" and len(candidates) == 1:
                p = candidates[0]
                return {
                    "action": "DELETE_PRODUCT",
                    "product_id": p.id,
                    "product_name": p.name,
                    "product_sku": p.sku,
                    "product_stock": p.current_stock,
                    "product_unit": p.unit,
                    "product_price": p.unit_price,
                    "delete_data": {
                        "product_id": p.id
                    }
                }
            elif m_type == "ambiguous":
                return {"action": "AMBIGUOUS", "term": prod_term, "candidates": candidates}

    return None


def handle_conversational_inventory(
    query: str,
    session_id: str,
    user: Optional[User],
    store_id: int,
    db: Session,
    source: str = "ai_chat"
) -> Dict[str, Any]:
    """
    Master handler for conversational inventory adjustments across AI chat, voice, and WhatsApp.
    Enforces the mandatory confirmation step, disambiguation, negative stock rules, and idempotency.
    """
    user_id = user.id if user else None
    q_clean = normalize_text(query)

    # 1. Check for active PENDING adjustment for this session
    pending = db.query(PendingInventoryAdjustment).filter(
        PendingInventoryAdjustment.session_id == session_id,
        PendingInventoryAdjustment.status == "PENDING"
    ).order_by(PendingInventoryAdjustment.created_at.desc()).first()

    # ── CASE A: Owner is Confirming or Cancelling an existing proposal ──
    if pending:
        conf_intent = is_confirmation_intent(q_clean)
        if conf_intent is True:
            # Execute the confirmed adjustment atomically
            return execute_confirmed_adjustment(db, pending, user_id)
        elif conf_intent is False:
            # Cancel the pending adjustment
            pending.status = "CANCELLED"
            db.commit()
            return {
                "response": "Theek hai, stock update cancel kar diya gaya hai. Store inventory mein koi changes nahi kiye gaye.",
                "status": "CANCELLED",
                "is_inventory_adjustment": True
            }

    # ── CASE B: Natural Language Product Management (Create, Price Update, Reorder, Delete, Check) ──
    mgmt_intent = parse_product_management_intent(query, db, store_id)
    if mgmt_intent:
        action = mgmt_intent["action"]

        if action == "CHECK_STOCK":
            p = mgmt_intent["product"]
            stat = "CRITICAL" if p.current_stock <= max(1, p.reorder_point // 3) else "LOW" if p.current_stock <= p.reorder_point else "OPTIMAL"
            return {
                "response": (
                    f"📦 *Live Stock Status: {p.name}*\n\n"
                    f"• *SKU:* `{p.sku}`\n"
                    f"• *Current Stock:* *{p.current_stock} {p.unit or 'pcs'}*\n"
                    f"• *Unit Price:* ₹{p.unit_price:.2f}\n"
                    f"• *Reorder Alert Level:* {p.reorder_point} {p.unit or 'pcs'}\n"
                    f"• *Health Status:* {stat}\n\n"
                    f"Stock update karne ke liye likhein (e.g. '50 packet {p.name} aaya')."
                ),
                "status": "STOCK_CHECK",
                "is_inventory_adjustment": True
            }

        elif action == "AMBIGUOUS":
            options_text = "\n".join(f"{idx}. *{c.name}* (Stock: {c.current_stock} {c.unit}, Price: ₹{c.unit_price})" for idx, c in enumerate(mgmt_intent["candidates"], 1))
            return {
                "response": f"❓ *Kaunse '{mgmt_intent['term']}' ki baat kar rahe hain?*\nMultiple matching products mile hain. Kripya chunein:\n\n{options_text}",
                "status": "AMBIGUOUS_PRODUCT",
                "candidates": [{"id": c.id, "name": c.name, "sku": c.sku, "stock": c.current_stock} for c in mgmt_intent["candidates"]],
                "is_inventory_adjustment": True
            }

        elif action == "CREATE_PRODUCT":
            p_data = mgmt_intent["product_data"]
            summary = (
                f"🆕 *Naya Product Catalog Mein Add Karna Hai?*\n\n"
                f"• *Product Name:* {p_data['name']}\n"
                f"• *Auto SKU:* `{p_data['sku']}`\n"
                f"• *Selling Price:* ₹{p_data['unit_price']:.2f}\n"
                f"• *Initial Stock:* {p_data['initial_stock']} {p_data['unit']}\n"
                f"• *Reorder Alert Level:* {p_data['reorder_point']} {p_data['unit']}\n"
                f"• *Category:* {p_data['category']}\n\n"
                f"Kya main yeh product store mein register kar doon? (Reply *Haan* / *Confirm*)"
            )
            idempotency_key = f"create_{session_id}_{int(datetime.now(timezone.utc).timestamp())}"
            pending_record = PendingInventoryAdjustment(
                session_id=session_id,
                store_id=store_id,
                user_id=user_id,
                status="PENDING",
                summary_text=summary,
                movements_json=json.dumps(mgmt_intent),
                source=source,
                idempotency_key=idempotency_key
            )
            db.add(pending_record)
            db.commit()
            return {
                "response": summary,
                "status": "PENDING_CONFIRMATION",
                "is_inventory_adjustment": True,
                "action": "CREATE_PRODUCT",
                "pending_id": pending_record.id,
                "proposals": [{
                    "product_name": p_data["name"],
                    "sku": p_data["sku"],
                    "unit": p_data["unit"],
                    "previous_stock": 0,
                    "new_stock": p_data["initial_stock"],
                    "net_change": p_data["initial_stock"],
                    "movements": [{"type": "RESTOCK", "quantity_delta": p_data["initial_stock"]}]
                }]
            }

        elif action == "UPDATE_PRODUCT":
            p_name = mgmt_intent["product_name"]
            p_sku = mgmt_intent["product_sku"]
            p_price = mgmt_intent["product_price"]
            p_reorder = mgmt_intent["product_reorder"]
            p_unit = mgmt_intent.get("product_unit") or "pcs"
            u_data = mgmt_intent["update_data"]
            if "new_price" in u_data:
                summary = (
                    f"🏷️ *Price Update Confirmation:*\n\n"
                    f"• *Product:* {p_name} (`{p_sku}`)\n"
                    f"• *Current Price:* ₹{p_price:.2f}\n"
                    f"• *New Price:* ₹{u_data['new_price']:.2f}\n\n"
                    f"Kya aap {p_name} ka price ₹{u_data['new_price']:.2f} update karna chahte hain? (Reply *Haan* / *Confirm*)"
                )
            else:
                summary = (
                    f"⚠️ *Reorder Level Update Confirmation:*\n\n"
                    f"• *Product:* {p_name} (`{p_sku}`)\n"
                    f"• *Current Alert Level:* {p_reorder} {p_unit}\n"
                    f"• *New Alert Level:* {u_data['new_reorder']} {p_unit}\n\n"
                    f"Kya aap {p_name} ka reorder level update karna chahte hain? (Reply *Haan* / *Confirm*)"
                )
            idempotency_key = f"upd_{session_id}_{int(datetime.now(timezone.utc).timestamp())}"
            pending_record = PendingInventoryAdjustment(
                session_id=session_id,
                store_id=store_id,
                user_id=user_id,
                status="PENDING",
                summary_text=summary,
                movements_json=json.dumps(mgmt_intent),
                source=source,
                idempotency_key=idempotency_key
            )
            db.add(pending_record)
            db.commit()
            return {
                "response": summary,
                "status": "PENDING_CONFIRMATION",
                "is_inventory_adjustment": True,
                "action": "UPDATE_PRODUCT",
                "pending_id": pending_record.id
            }

        elif action == "DELETE_PRODUCT":
            p_name = mgmt_intent["product_name"]
            p_sku = mgmt_intent["product_sku"]
            p_stock = mgmt_intent.get("product_stock", 0)
            p_unit = mgmt_intent.get("product_unit") or "pcs"
            p_price = mgmt_intent.get("product_price", 0.0)
            summary = (
                f"🗑️ *Product Delete Confirmation:*\n\n"
                f"• *Product:* {p_name} (`{p_sku}`)\n"
                f"• *Current Stock:* {p_stock} {p_unit}\n"
                f"• *Price:* ₹{p_price:.2f}\n\n"
                f"⚠️ *Warning:* Kya aap sach mein is product ko store catalog se delete karna chahte hain? (Reply *Haan* / *Confirm*)"
            )
            idempotency_key = f"del_{session_id}_{int(datetime.now(timezone.utc).timestamp())}"
            pending_record = PendingInventoryAdjustment(
                session_id=session_id,
                store_id=store_id,
                user_id=user_id,
                status="PENDING",
                summary_text=summary,
                movements_json=json.dumps(mgmt_intent),
                source=source,
                idempotency_key=idempotency_key
            )
            db.add(pending_record)
            db.commit()
            return {
                "response": summary,
                "status": "PENDING_CONFIRMATION",
                "is_inventory_adjustment": True,
                "action": "DELETE_PRODUCT",
                "pending_id": pending_record.id
            }

    # ── CASE C: Standard stock movement parsing (Restock, Sale, Damaged, Return, Correction) ──
    parsed_movements = parse_inventory_utterance(query, db)
    if not parsed_movements:
        return {
            "response": "Mujhe is statement mein koi clear stock adjustment nahi dikha. Kripya product name, quantity aur action batayein (jaise: '50 packet Maggi ka stock aaya hai').",
            "status": "NOT_AN_ADJUSTMENT",
            "is_inventory_adjustment": False
        }

    # 2. Check store settings for negative stock policy
    allow_neg_setting = db.query(StoreSetting).filter(StoreSetting.key == "allow_negative_stock").first()
    allow_negative_stock = (allow_neg_setting.value.lower() == "true") if allow_neg_setting else False

    # 3. Resolve products & group movements by product
    by_product_movements: Dict[str, List[Dict[str, Any]]] = {}
    for m in parsed_movements:
        raw_p = m["raw_product"].strip()
        by_product_movements.setdefault(raw_p, []).append(m)

    proposals = []
    disambiguations = []
    not_found_products = []

    for raw_p, m_list in by_product_movements.items():
        match_type, candidates = match_product(db, store_id, raw_p)

        if match_type == "not_found":
            not_found_products.append(raw_p)
            continue
        elif match_type == "ambiguous":
            disambiguations.append({"term": raw_p, "candidates": candidates, "movements": m_list})
            continue

        # Exact match found
        prod = candidates[0]
        prev_st = prod.current_stock
        unit = prod.unit or "pcs"

        # Calculate net change
        net_change = 0
        is_correction = False
        target_stock = prev_st

        for m in m_list:
            m_type = m["movement_type"]
            m_qty = m["quantity"]
            if m_type == "CORRECTION":
                is_correction = True
                target_stock = m_qty
            else:
                multiplier = MOVEMENT_TYPES.get(m_type, {}).get("multiplier", 0)
                net_change += (multiplier * m_qty)

        new_st = target_stock if is_correction else (prev_st + net_change)

        # Check negative stock constraint
        if new_st < 0 and not allow_negative_stock:
            return {
                "response": (
                    f"⚠️ *Stock Insufficient Error*: '{prod.name}' ka current stock *{prev_st} {unit}* hai, "
                    f"lekin aap *{abs(net_change)} {unit}* deduct karne ki koshish kar rahe hain. "
                    f"Store policy ke mutabik stock negative nahi ho sakta. Kripya quantity check karein."
                ),
                "status": "ERROR_NEGATIVE_STOCK",
                "is_inventory_adjustment": True
            }

        proposals.append({
            "product_id": prod.id,
            "product_name": prod.name,
            "sku": prod.sku,
            "unit": unit,
            "previous_stock": prev_st,
            "net_change": (new_st - prev_st) if is_correction else net_change,
            "new_stock": new_st,
            "movements": m_list
        })

    # 4. Handle Disambiguation or Unknown Products
    if not_found_products:
        p_names = ", ".join(f"'{p}'" for p in not_found_products)
        return {
            "response": (
                f"⚠️ Store database mein {p_names} naam ka koi product nahi mila.\n"
                "Kripya catalog mein se sahi product name, brand ya SKU batayein."
            ),
            "status": "PRODUCT_NOT_FOUND",
            "is_inventory_adjustment": True
        }

    if disambiguations:
        d = disambiguations[0]
        options_text = "\n".join(f"{idx}. *{c.name}* (Current stock: {c.current_stock} {c.unit})" for idx, c in enumerate(d["candidates"], 1))
        return {
            "response": (
                f"❓ *Kaunse '{d['term']}' ki baat kar rahe hain?*\n"
                "Multiple matching products mile hain. Kripya sahi product chunein:\n\n"
                f"{options_text}\n\n"
                "Aap product ka poora naam ya number likhkar reply kar sakte hain."
            ),
            "status": "AMBIGUOUS_PRODUCT",
            "candidates": [{"id": c.id, "name": c.name, "sku": c.sku, "stock": c.current_stock} for c in d["candidates"]],
            "is_inventory_adjustment": True
        }

    if not proposals:
        return {
            "response": "Stock adjustment ke liye koi valid product match nahi ho paya.",
            "status": "NO_VALID_PRODUCTS",
            "is_inventory_adjustment": False
        }

    # 5. Generate Mandatory Confirmation Summary & Stage in Database
    summary = build_confirmation_summary(proposals)
    idempotency_key = f"adj_{session_id}_{int(datetime.now(timezone.utc).timestamp())}"

    # Invalidate any older pending adjustments for this session
    db.query(PendingInventoryAdjustment).filter(
        PendingInventoryAdjustment.session_id == session_id,
        PendingInventoryAdjustment.status == "PENDING"
    ).update({"status": "EXPIRED"})

    pending_record = PendingInventoryAdjustment(
        session_id=session_id,
        store_id=store_id,
        user_id=user_id,
        status="PENDING",
        summary_text=summary,
        movements_json=json.dumps(proposals),
        source=source,
        idempotency_key=idempotency_key
    )
    db.add(pending_record)
    db.commit()

    return {
        "response": summary,
        "status": "PENDING_CONFIRMATION",
        "is_inventory_adjustment": True,
        "proposals": proposals,
        "idempotency_key": idempotency_key
    }


def execute_confirmed_adjustment(
    db: Session,
    pending: PendingInventoryAdjustment,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes an approved inventory adjustment within an atomic DB transaction.
    Uses row-level locking (with_for_update) to prevent race conditions.
    Never overwrites historical movements; records each step into StockTransaction.
    """
    if pending.status == "CONFIRMED":
        # Idempotency: Already executed
        return {
            "response": "Yeh inventory update pehle hi confirm aur execute ho chuka hai! Duplicate deduction rok di gayi hai.",
            "status": "ALREADY_CONFIRMED",
            "is_inventory_adjustment": True
        }

    payload = json.loads(pending.movements_json)
    effective_user_id = user_id or pending.user_id or 1

    try:
        if isinstance(payload, dict) and "action" in payload:
            action = payload["action"]
            if action == "CREATE_PRODUCT":
                p_data = payload["product_data"]
                new_prod = Product(
                    store_id=pending.store_id,
                    name=p_data["name"],
                    sku=p_data["sku"],
                    category=p_data.get("category", "Grocery"),
                    unit_price=p_data["unit_price"],
                    current_stock=p_data.get("initial_stock", 0),
                    reorder_point=p_data.get("reorder_point", 10),
                    unit=p_data.get("unit", "pcs"),
                    barcode="",
                    aliases=json.dumps([p_data["name"].lower()])
                )
                db.add(new_prod)
                db.commit()
                db.refresh(new_prod)

                if new_prod.current_stock > 0:
                    txn = StockTransaction(
                        product_id=new_prod.id,
                        type="RESTOCK",
                        movement_type="RESTOCK",
                        quantity=new_prod.current_stock,
                        before_stock=0,
                        after_stock=new_prod.current_stock,
                        unit=new_prod.unit,
                        user_id=effective_user_id,
                        store_id=pending.store_id,
                        source=pending.source,
                        notes=f"Initial stock on creation via {pending.source}"
                    )
                    db.add(txn)

                pending.status = "CONFIRMED"
                db.commit()

                msg = (
                    f"🎉 *Naya Product Successfully Catalog Mein Add Ho Gaya!*\n\n"
                    f"• *Product:* {new_prod.name}\n"
                    f"• *SKU:* `{new_prod.sku}`\n"
                    f"• *Price:* ₹{new_prod.unit_price:.2f}\n"
                    f"• *Initial Stock:* {new_prod.current_stock} {new_prod.unit}\n"
                    f"• *Reorder Alert Level:* {new_prod.reorder_point} {new_prod.unit}\n\n"
                    f"Ab aap iska stock update aur sales billing direct AI se kar sakte hain."
                )
                return {
                    "response": msg,
                    "status": "CONFIRMED",
                    "is_inventory_adjustment": True,
                    "action": "CREATE_PRODUCT",
                    "product_id": new_prod.id
                }

            elif action == "UPDATE_PRODUCT":
                u_data = payload["update_data"]
                prod_id = u_data["product_id"]
                prod = db.query(Product).filter(Product.id == prod_id).first()
                if not prod:
                    raise ValueError("Product not found.")

                changes = []
                if "new_price" in u_data:
                    old_p = prod.unit_price
                    prod.unit_price = u_data["new_price"]
                    changes.append(f"Price: ₹{old_p:.2f} ➔ ₹{prod.unit_price:.2f}")
                if "new_reorder" in u_data:
                    old_r = prod.reorder_point
                    prod.reorder_point = u_data["new_reorder"]
                    changes.append(f"Reorder Level: {old_r} ➔ {prod.reorder_point}")

                pending.status = "CONFIRMED"
                db.commit()

                changes_str = "\n• ".join(changes)
                msg = f"✅ *Product Details Successfully Updated!*\n\n• *{prod.name}*\n• {changes_str}"
                return {
                    "response": msg,
                    "status": "CONFIRMED",
                    "is_inventory_adjustment": True,
                    "action": "UPDATE_PRODUCT"
                }

            elif action == "DELETE_PRODUCT":
                d_data = payload["delete_data"]
                prod_id = d_data["product_id"]
                prod = db.query(Product).filter(Product.id == prod_id).first()
                p_name = prod.name if prod else f"Product #{prod_id}"
                if prod:
                    db.delete(prod)
                pending.status = "CONFIRMED"
                db.commit()

                return {
                    "response": f"🗑️ *'{p_name}' ko store catalog se successfully delete kar diya gaya hai.*",
                    "status": "CONFIRMED",
                    "is_inventory_adjustment": True,
                    "action": "DELETE_PRODUCT"
                }

        proposals = payload
        updated_items = []
        for item in proposals:
            prod_id = item["product_id"]
            product = db.query(Product).filter(Product.id == prod_id).with_for_update().first()
            if not product:
                raise ValueError(f"Product #{prod_id} not found in database.")

            before_st = product.current_stock
            final_target = item["new_stock"]
            product.current_stock = final_target

            # Write individual movement audit records
            for m in item["movements"]:
                m_type = m["movement_type"]
                m_qty = m["quantity"]
                txn = StockTransaction(
                    product_id=product.id,
                    type=m_type,
                    movement_type=m_type,
                    quantity=m_qty,
                    before_stock=before_st,
                    after_stock=final_target,
                    unit=product.unit,
                    user_id=effective_user_id,
                    store_id=pending.store_id,
                    source=pending.source,
                    notes=f"Conversational update: {m_type} {m_qty} {product.unit} via {pending.source}"
                )
                db.add(txn)

            updated_items.append({
                "name": product.name,
                "unit": product.unit,
                "previous_stock": before_st,
                "new_stock": final_target,
                "net_change": item["net_change"]
            })

        pending.status = "CONFIRMED"
        db.commit()

        # Build natural conversational confirmation response
        msg_parts = []
        for u in updated_items:
            sign = "+" if u["net_change"] > 0 else ""
            msg_parts.append(
                f"• *{u['name']}*: Stock {u['previous_stock']} se badalkar *{u['new_stock']} {u['unit']}* ho gaya ({sign}{u['net_change']})."
            )

        success_response = (
            "✅ *Bilkul! Aapka stock update ho gaya hai.*\n\n"
            + "\n".join(msg_parts) +
            "\n\nSabhi stock movement records store ledger mein save ho gaye hain."
        )

        return {
            "response": success_response,
            "status": "CONFIRMED",
            "is_inventory_adjustment": True,
            "updated_items": updated_items
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error executing confirmed inventory adjustment: {e}")
        return {
            "response": f"⚠️ Stock update execute karte waqt error aaya: {str(e)[:150]}. Database rollback kar diya gaya hai.",
            "status": "EXECUTION_ERROR",
            "is_inventory_adjustment": True
        }
