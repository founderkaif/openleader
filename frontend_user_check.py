import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


async def main():
    csv_path = Path("c:/Users/Admin/Desktop/openlead/leads_output/leads_Gyms_in_Mumbai_20260509_145121.csv")
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://localhost:5173/", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)

        file_input = page.locator('input[type="file"]')
        await file_input.set_input_files(str(csv_path))
        await page.wait_for_timeout(1500)

        imported_ok = await page.get_by_text("Imported 15 real leads").count()
        has_lead = await page.get_by_text("Strength Gym - Khar").count()
        has_location_col = await page.get_by_text("Location").count()

        print(f"import_log_found={imported_ok}")
        print(f"lead_visible={has_lead}")
        print(f"location_column_visible={has_location_col}")

        await page.screenshot(path="c:/Users/Admin/Desktop/openlead/frontend-user-check.png", full_page=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
