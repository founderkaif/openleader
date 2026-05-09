import asyncio

from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://localhost:5174/", wait_until="domcontentloaded")
        await page.fill('input[placeholder*="Gyms in Mumbai"]', "Gyms in Mumbai")
        await page.click("button:has-text('Start Scraping')")
        await page.wait_for_timeout(7000)
        logs = await page.locator("div").all_inner_texts()
        print(f"log_blocks={len(logs)}")
        print("page_has_error=", await page.locator("text=[warn]").count())
        await page.screenshot(path="c:/Users/Admin/Desktop/openlead/start-button-check.png", full_page=True)
        await page.wait_for_selector("text=Strength Gym - Khar", timeout=120000)

        total_leads = await page.locator("text=Total Leads").count()
        has_first = await page.locator("text=Strength Gym - Khar").count()

        print(f"total_card_present={total_leads}")
        print(f"first_lead_present={has_first}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
