from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto('http://localhost:5174')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='e:/Reasonix/OpsHub/screenshot.png', full_page=True)
    print('Screenshot saved to e:/Reasonix/OpsHub/screenshot.png')
    browser.close()