#!/usr/bin/env python3
"""
Google Maps Lead Generator - Backend Scraper
Install: pip install playwright pandas openpyxl
Setup:   playwright install chromium
Run:     python gmaps_scraper.py
"""

import argparse
import asyncio
import csv
import json
import re
from datetime import datetime
from pathlib import Path

try:
    from playwright.async_api import async_playwright
    import pandas as pd

    DEPS_OK = True
except ImportError:
    DEPS_OK = False


GMAPS_URL = "https://www.google.com/maps/search/{query}"

SELECTORS = {
    "results_list": '[role="feed"]',
    "result_item": 'a[href*="/maps/place/"]',
    "name": 'h1.DUwDvf, h1[class*="fontHeadlineLarge"]',
    "address": 'button[data-item-id="address"] .Io6YTe, [data-item-id="address"]',
    "phone": 'button[data-item-id^="phone"] .Io6YTe',
    "website": 'a[data-item-id="authority"]',
    "email_pattern": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "category": 'button[jsaction*="category"] span, .DkEaL',
    "rating": 'div.F7nice span[aria-hidden]',
    "reviews": 'div.F7nice span[aria-label*="review"]',
}


def clean_address(value: str) -> str:
    """Normalize address text returned by Google Maps selectors."""
    if not value:
        return ""
    value = value.strip()
    value = re.sub(r"^Address:\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^[^\w0-9]+", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


async def scroll_results(page, target_count: int, keep_going: bool = False):
    """Scroll the results panel to load more items."""
    feed = await page.query_selector(SELECTORS["results_list"])
    if not feed:
        return

    prev_count = 0
    stall = 0
    while True:
        items = await page.query_selector_all(SELECTORS["result_item"])
        count = len(items)
        print(f"  [scroll] Found {count} results so far...", end="\r")
        if not keep_going and count >= target_count:
            break
        if count == prev_count:
            stall += 1
            if stall >= 5:
                print("\n  [scroll] No more results to load.")
                break
        else:
            stall = 0
        prev_count = count
        await feed.evaluate("el => el.scrollBy(0, 800)")
        await asyncio.sleep(1.2)
    print()


async def extract_email_from_website(page, url: str) -> str:
    """Visit website and look for email addresses."""
    if not url:
        return ""
    try:
        await page.goto(url, timeout=10000, wait_until="domcontentloaded")
        content = await page.content()
        emails = re.findall(SELECTORS["email_pattern"], content)
        filtered = [
            e
            for e in emails
            if not any(
                x in e
                for x in [
                    "example",
                    "yourdomain",
                    "domain.com",
                    "email@",
                    "@2x",
                    ".png",
                    ".jpg",
                ]
            )
        ]
        return filtered[0] if filtered else ""
    except Exception:
        return ""


async def scrape_place(context, url: str, fetch_email: bool = True) -> dict:
    """Open a place page and extract all available info."""
    page = await context.new_page()
    data = {
        "name": "",
        "address": "",
        "location_full": "",
        "phone": "",
        "email": "",
        "website": "",
        "category": "",
        "rating": "",
        "reviews": "",
        "maps_url": url,
    }
    try:
        await page.goto(url, timeout=15000, wait_until="domcontentloaded")
        await asyncio.sleep(1.5)

        el = await page.query_selector(SELECTORS["name"])
        if el:
            data["name"] = (await el.inner_text()).strip()

        el = await page.query_selector(SELECTORS["address"])
        if el:
            data["address"] = clean_address((await el.inner_text()))
            data["location_full"] = data["address"]
        else:
            address_btn = await page.query_selector('button[data-item-id="address"]')
            if address_btn:
                aria_label = await address_btn.get_attribute("aria-label") or ""
                data["address"] = clean_address(aria_label)
                data["location_full"] = data["address"]

        el = await page.query_selector(SELECTORS["phone"])
        if el:
            data["phone"] = (await el.inner_text()).strip()

        el = await page.query_selector(SELECTORS["website"])
        if el:
            data["website"] = await el.get_attribute("href") or ""

        el = await page.query_selector(SELECTORS["category"])
        if el:
            data["category"] = (await el.inner_text()).strip()

        el = await page.query_selector(SELECTORS["rating"])
        if el:
            data["rating"] = (await el.inner_text()).strip()

        el = await page.query_selector(SELECTORS["reviews"])
        if el:
            label = await el.get_attribute("aria-label") or ""
            nums = re.findall(r"\d+", label.replace(",", ""))
            data["reviews"] = nums[0] if nums else ""

        if fetch_email and data["website"]:
            email_page = await context.new_page()
            try:
                data["email"] = await extract_email_from_website(
                    email_page, data["website"]
                )
            finally:
                await email_page.close()

    except Exception as e:
        print(f"  [warn] Error scraping {url}: {e}")
    finally:
        await page.close()
    return data


async def run_scraper(
    query: str,
    max_leads: int,
    output_format: str = "csv",
    output_dir: str = ".",
    fetch_emails: bool = True,
    keep_going: bool = False,
):
    """Main scraper function."""
    print(f"\n{'=' * 60}")
    print("  LeadGen Scraper — Google Maps")
    print(f"  Query    : {query}")
    print(f"  Max leads: {'unlimited' if keep_going else max_leads}")
    print(f"  Format   : {output_format.upper()}")
    print(f"{'=' * 60}\n")

    leads = []
    search_url = GMAPS_URL.format(query=query.replace(" ", "+"))

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--start-maximized"])
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/120 Safari/537.36"
            ),
        )

        page = await context.new_page()
        print(f"[1/3] Opening Google Maps: {search_url}")
        await page.goto(search_url, timeout=20000)
        await asyncio.sleep(2)

        try:
            btn = await page.query_selector('button[aria-label*="Accept"], form button')
            if btn:
                await btn.click()
                await asyncio.sleep(1)
        except Exception:
            pass

        print(f"[2/3] Loading results (target: {'all' if keep_going else max_leads})...")
        await scroll_results(page, max_leads, keep_going)

        items = await page.query_selector_all(SELECTORS["result_item"])
        hrefs = []
        seen = set()
        for item in items:
            href = await item.get_attribute("href")
            if href and href not in seen:
                seen.add(href)
                hrefs.append(href)
            if not keep_going and len(hrefs) >= max_leads:
                break

        await page.close()
        print(f"[2/3] Collected {len(hrefs)} place URLs.\n")

        print("[3/3] Scraping details for each place...")
        for i, url in enumerate(hrefs, 1):
            print(f"  ({i}/{len(hrefs)}) Scraping...", end=" ")
            lead = await scrape_place(context, url, fetch_emails)
            if lead["name"]:
                lead["searched_query"] = query
                lead["location_full"] = lead.get("location_full") or lead.get("address", "")
                leads.append(lead)
                print(f"[OK] {lead['name']}")
            else:
                print("[SKIP] (no name found)")

        await browser.close()

    if not leads:
        print("\n[!] No leads found. Try a different keyword.")
        return

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_query = re.sub(r"[^a-zA-Z0-9]", "_", query)[:30]
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    if output_format in ("csv", "both"):
        csv_file = out_path / f"leads_{safe_query}_{ts}.csv"
        keys = [
            "name",
            "searched_query",
            "location_full",
            "phone",
            "email",
            "address",
            "website",
            "category",
            "rating",
            "reviews",
            "maps_url",
        ]
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(leads)
        print(f"\n[OK] CSV saved  -> {csv_file}")

    if output_format in ("excel", "both"):
        try:
            excel_file = out_path / f"leads_{safe_query}_{ts}.xlsx"
            df = pd.DataFrame(leads)
            df.to_excel(excel_file, index=False)
            print(f"[OK] Excel saved -> {excel_file}")
        except ImportError:
            print("[!] Install openpyxl for Excel export: pip install openpyxl")

    if output_format == "json":
        json_file = out_path / f"leads_{safe_query}_{ts}.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(leads, f, ensure_ascii=False, indent=2)
        print(f"[OK] JSON saved  -> {json_file}")

    print(f"\n[STATS] Total leads scraped: {len(leads)}")
    print("=" * 60)
    return leads


def main():
    parser = argparse.ArgumentParser(
        description="Google Maps Lead Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python gmaps_scraper.py "Gyms in Mumbai" --count 50
  python gmaps_scraper.py "Restaurants in Delhi" --count 100 --format excel
  python gmaps_scraper.py "IT companies Pune" --keep-going --format both
  python gmaps_scraper.py "Salons Bangalore" --count 200 --no-email
        """,
    )
    parser.add_argument("query", help='Search keyword e.g. "Gyms in Mumbai"')
    parser.add_argument(
        "--count", "-n", type=int, default=50, help="Number of leads (default: 50)"
    )
    parser.add_argument(
        "--format", "-f", choices=["csv", "excel", "json", "both"], default="csv"
    )
    parser.add_argument("--output", "-o", default="./leads_output", help="Output directory")
    parser.add_argument(
        "--keep-going", action="store_true", help="Scrape ALL available results (ignore --count)"
    )
    parser.add_argument(
        "--no-email", action="store_true", help="Skip email fetching (faster)"
    )
    args = parser.parse_args()

    if not DEPS_OK:
        print("\n[ERROR] Missing dependencies. Run:\n")
        print("  pip install playwright pandas openpyxl")
        print("  playwright install chromium\n")
        return

    asyncio.run(
        run_scraper(
            query=args.query,
            max_leads=args.count,
            output_format=args.format,
            output_dir=args.output,
            fetch_emails=not args.no_email,
            keep_going=args.keep_going,
        )
    )


if __name__ == "__main__":
    main()
