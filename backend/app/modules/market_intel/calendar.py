"""
Bharat Festival & Market Seasonality Intelligence Engine.
Computes upcoming Indian festivals, festive demand surge windows, and recommended inventory buffers.
"""

from datetime import date, datetime
from typing import Dict, List, Optional


INDIAN_FESTIVALS_MASTER = [
    {
        "id": "makar_sankranti",
        "name": "Makar Sankranti & Pongal",
        "month": 1,
        "approx_day": 14,
        "date_display": "Jan 14 - 15",
        "surge_level": "HIGH DEMAND (+35%)",
        "impact_summary": "Winter harvest celebration; huge surge in jaggery, sesame (til), rice, ghee, and kite accessories.",
        "recommended_stock": "Til, Gur/Jaggery, Basmati Rice, Ghee, Chikki, Sweets",
        "high_demand_products": ["Organic Jaggery", "White Sesame (Til)", "Amul Pure Ghee", "Kolam / Ponni Rice", "Peanut Chikki"],
    },
    {
        "id": "republic_day",
        "name": "Republic Day Mega Clearance",
        "month": 1,
        "approx_day": 26,
        "date_display": "Jan 26",
        "surge_level": "STEADY SURGE (+25%)",
        "impact_summary": "National holiday long weekend; bulk grocery stocking and snack purchases.",
        "recommended_stock": "Biscuits, Namkeen family packs, Cold drinks, Tea & Coffee",
        "high_demand_products": ["Parle-G 800g Family Pack", "Haldiram Bhujia 1kg", "Tata Tea Gold", "Coca Cola 2L"],
    },
    {
        "id": "maha_shivratri",
        "name": "Maha Shivratri Fasting Window",
        "month": 3,
        "approx_day": 8,
        "date_display": "Late Feb / Early March",
        "surge_level": "HIGH DEMAND (+40%)",
        "impact_summary": "Widespread fasting observance across North, Central, and Western India; fasting food sales surge 3x.",
        "recommended_stock": "Sabudana, Sendha Namak, Kuttu Atta, Makhana, Milk, Bananas",
        "high_demand_products": ["Nylon Sabudana", "Rock Salt (Sendha Namak)", "Singhara / Kuttu Atta", "Phool Makhana", "Amul Taaza Milk"],
    },
    {
        "id": "holi",
        "name": "Holi & Dhulandi Celebration",
        "month": 3,
        "approx_day": 25,
        "date_display": "Mid / Late March",
        "surge_level": "CRITICAL SPIKE (+55%)",
        "impact_summary": "Festival of colors; immense spike in sweets ingredients, thandai, namkeen, cooking oil, and skin moisturizers.",
        "recommended_stock": "Maida, Suji, Khoya/Mawa, Edible Oil, Thandai Syrup, Gulal, Coconut Oil",
        "high_demand_products": ["Fortune Maida 1kg", "Madhur Pure Sugar", "Haldiram Gujiya", "Guruji Thandai 750ml", "Parachute Coconut Oil"],
    },
    {
        "id": "chaitra_navratri",
        "name": "Chaitra Navratri & Ram Navami",
        "month": 4,
        "approx_day": 10,
        "date_display": "Early April",
        "surge_level": "HIGH DEMAND (+35%)",
        "impact_summary": "9 days of fasting followed by feasts; high demand for pure dairy, fruits, pooja items, and dry fruits.",
        "recommended_stock": "Desi Ghee, Samak Rice, Cashews, Almonds, Agarbatti, Camphor",
        "high_demand_products": ["Patanjali Cow Ghee", "Samak Ke Chawal", "California Almonds 500g", "Mangaldeep Agarbatti", "Camphor Tablets"],
    },
    {
        "id": "summer_ipl",
        "name": "Summer Heat & IPL Match Season",
        "month": 5,
        "approx_day": 1,
        "date_display": "May - June Peak",
        "surge_level": "HIGH DEMAND (+45%)",
        "impact_summary": "Scorching temperatures drive cold beverages, ice creams, instant energy drinks, and match-viewing snacks.",
        "recommended_stock": "Soft drinks, Glucose, Fruit juices, Ice creams, Chips & Kurkure",
        "high_demand_products": ["Glucon-D Orange 1kg", "Real Mixed Fruit Juice 1L", "Lay's Classic Family Pack", "Frooti Mango Drink", "Sprite 2.25L"],
    },
    {
        "id": "raksha_bandhan",
        "name": "Raksha Bandhan & Independence Day",
        "month": 8,
        "approx_day": 19,
        "date_display": "Mid August",
        "surge_level": "CRITICAL SPIKE (+50%)",
        "impact_summary": "Top sibling gifting occasion in India; explosive chocolate, confectionery, dry fruit, and ready sweets demand.",
        "recommended_stock": "Cadbury Celebrations, Kaju Katli, Ferrero Rocher, Rakhi combos, Rooh Afza",
        "high_demand_products": ["Cadbury Celebrations 130g/280g", "Haldiram Kaju Katli", "Nestle KitKat Share Bag", "Hamdard Rooh Afza 750ml"],
    },
    {
        "id": "janmashtami",
        "name": "Janmashtami Celebrations",
        "month": 8,
        "approx_day": 26,
        "date_display": "Late August",
        "surge_level": "HIGH DEMAND (+30%)",
        "impact_summary": "Midnight birthday celebration of Lord Krishna; intense demand for fresh milk, butter, ghee, and panjiri items.",
        "recommended_stock": "Fresh Butter, Full Cream Milk, Makhana, Mishri, Dhaniya Powder",
        "high_demand_products": ["Amul Butter 500g", "Amul Gold Milk", "Mishri Candy", "Tata Sampann Coriander Powder"],
    },
    {
        "id": "ganesh_chaturthi",
        "name": "Ganesh Chaturthi Utsav (10 Days)",
        "month": 9,
        "approx_day": 7,
        "date_display": "September",
        "surge_level": "CRITICAL SPIKE (+50%)",
        "impact_summary": "Grand 10-day community festivities across Maharashtra, Karnataka, and Telangana. Modak ingredients and pooja samagri surge.",
        "recommended_stock": "Rice Flour, Jaggery, Coconut, Modak moulds, Ghee, Incense, Cardamom",
        "high_demand_products": ["Fine Rice Flour 1kg", "Fresh Grated Coconut", "Elaichi (Cardamom) 50g", "Cycle Pure Agarbatti", "Gowardhan Ghee 1L"],
    },
    {
        "id": "navratri_dussehra",
        "name": "Navratri, Durga Puja & Dussehra",
        "month": 10,
        "approx_day": 15,
        "date_display": "October",
        "surge_level": "CRITICAL SPIKE (+60%)",
        "impact_summary": "9 nights of Garba & Durga Puja celebrations leading up to Vijayadashami. High consumer spending across snacks and grocery.",
        "recommended_stock": "Sendha Namak, Kuttu Atta, Packaged Sweets, Cooking Oil, Pooja Kits",
        "high_demand_products": ["Fortune Kachi Ghani Mustard Oil", "Aashirvaad Shudh Chakki Atta", "Bikaji Soan Papdi", "Dry Coconut (Gola)"],
    },
    {
        "id": "diwali_dhanteras",
        "name": "Diwali, Dhanteras & Laxmi Pujan",
        "month": 11,
        "approx_day": 1,
        "date_display": "Late Oct / Early Nov",
        "surge_level": "ANNUAL MEGA PEAK (+75%)",
        "impact_summary": "The biggest shopping event in Bharat! Multi-category explosive demand: gifting, sweets, dry fruits, pooja goods, home cleaning.",
        "recommended_stock": "Cadbury Gift Boxes, Kaju/Badam/Pista 1kg, Pure Cow Ghee, Besan, Maida, Cooking Oil, Dettol/Lizol",
        "high_demand_products": [
            "Cadbury Celebrations Rich Dry Fruit Box",
            "Haldiram Gulab Jamun 1kg Tin",
            "Fortune Refined Sunflower Oil 5L Jar",
            "Amul Pure Ghee 1L Tin",
            "Lizol Disinfectant Surface Cleaner 2L",
            "Premium W320 Cashews 500g"
        ],
    },
    {
        "id": "bhai_dooj_chhath",
        "name": "Bhai Dooj & Chhath Puja Mahaparv",
        "month": 11,
        "approx_day": 7,
        "date_display": "Early / Mid November",
        "surge_level": "CRITICAL SPIKE (+65%)",
        "impact_summary": "Chhath Puja in Bihar, UP, Delhi-NCR, Mumbai creates massive demand for thekua ingredients: pure ghee, atta, jaggery, sooji.",
        "recommended_stock": "Chhath Atta, Kolhapur Gur/Jaggery, Sooji, Pure Ghee, Sugar, Coconut, Betel nuts",
        "high_demand_products": [
            "Aashirvaad Select Sharbati Atta 5kg",
            "Patna / Kolhapur Jaggery (Gur)",
            "Fortune Sooji 500g",
            "Mother Dairy Pure Ghee 1L",
            "Dry Dates (Chuara) 500g"
        ],
    },
    {
        "id": "wedding_season",
        "name": "Winter Wedding & Celebration Season",
        "month": 11,
        "approx_day": 20,
        "date_display": "Nov 20 - Dec 15",
        "surge_level": "HIGH DEMAND (+40%)",
        "impact_summary": "Millions of weddings across India drive bulk wholesale purchases of rice, oil, pulses, spices, and personal grooming kits.",
        "recommended_stock": "Basmati Rice 25kg/10kg bags, Edible Oil 15L tins, Everest/MDH bulk spices, Shaving & grooming hampers",
        "high_demand_products": ["India Gate Basmati Rice Feast Rozzana 10kg", "Fortune Soya Oil 15L Tin", "MDH Deggi Mirch 500g", "Gillette Mach3 Gift Pack"],
    },
    {
        "id": "christmas_newyear",
        "name": "Christmas & New Year Celebration Peak",
        "month": 12,
        "approx_day": 25,
        "date_display": "Dec 24 - Jan 01",
        "surge_level": "HIGH DEMAND (+45%)",
        "impact_summary": "Year-end party shopping, plum cakes, chocolates, beverages, bakery items, and winter skin cold creams.",
        "recommended_stock": "Plum Cakes, Chocolate boxes, Carbonated beverages, Chips, Nivea / Ponds cold creams",
        "high_demand_products": ["Britannia Rich Plum Cake", "Ferrero Rocher T16", "Nivea Soft Cream 200ml", "Pepsi 2L Party Pack", "Doritos Nacho Cheese"],
    },
]


def get_upcoming_festivals(limit: int = 6) -> List[Dict]:
    """
    Returns ordered upcoming festivals from current date onwards.
    Calculates dynamic days_remaining and returns rich recommendations.
    """
    today = date.today()
    current_month = today.month
    current_day = today.day

    annotated = []
    for fest in INDIAN_FESTIVALS_MASTER:
        fest_month = fest["month"]
        fest_day = fest["approx_day"]

        # Approximate days remaining
        if fest_month > current_month:
            days_rem = (fest_month - current_month) * 30 + (fest_day - current_day)
        elif fest_month == current_month:
            days_rem = max(0, fest_day - current_day)
        else:
            # Next year's occurrence
            days_rem = ((12 - current_month) + fest_month) * 30 + (fest_day - current_day)

        item = dict(fest)
        item["days_remaining"] = days_rem
        item["description"] = fest["impact_summary"]
        annotated.append(item)

    # Sort primarily by days_remaining
    annotated.sort(key=lambda x: x["days_remaining"])
    return annotated[:limit]


def get_active_month_opportunity() -> Dict:
    """Returns the most relevant festival/event opportunity for current month."""
    fests = get_upcoming_festivals(limit=1)
    if fests:
        f = fests[0]
        return {
            "key_event": f["name"],
            "date": f["date_display"],
            "high_demand_categories": ["Grocery", "FMCG", "Dairy"],
            "tip": f"{f['name']}: {f['impact_summary']}",
            "recommended_stock": f["recommended_stock"],
        }
    return {
        "key_event": "Monthly Retail Grocery Cycle",
        "date": "Month-end / Month-start",
        "high_demand_categories": ["Grocery", "Staples"],
        "tip": "Month-start salary grocery replenishment spike expected.",
        "recommended_stock": "Atta, Rice, Oil, Dal, Sugar",
    }
