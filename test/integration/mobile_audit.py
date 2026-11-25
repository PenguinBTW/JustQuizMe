"""Mobile + accessibility audit at 390px — reproducible evidence collection."""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = 'http://localhost:3000'
PORTALS = ['cs', 'maths', 'physics']
results = {}

def rec(check, portal, ok, evidence=''):
    results.setdefault(check, {})[portal] = {'status': 'pass' if ok else 'FAIL', 'evidence': evidence[:160]}

async def audit_portal(pw, portal):
    b = await pw.chromium.launch(args=['--no-sandbox'])
    page = await b.new_page(viewport={'width': 390, 'height': 844})
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:120]))
    P = f'/{portal}/'

    # 1. horizontal overflow on the home view
    await page.goto(BASE + P, wait_until='domcontentloaded')
    await page.wait_for_timeout(2500)
    overflow = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    wide = await page.evaluate('''() => {
      const vw = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > vw + 4 && out.length < 5) out.push((el.className && String(el.className).slice(0,40)) || el.tagName);
      });
      return out;
    }''')
    rec('no-horizontal-overflow', portal, overflow <= 1, f'overflow={overflow}px wide={wide}')

    # 2. small touch targets among primary interactive elements
    small = await page.evaluate('''() => {
      const out = [];
      document.querySelectorAll('button, a, input[type=checkbox], .mcq-opt, .mcq-option, [role=button]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 24 && out.length < 6) {
          out.push(((el.textContent || '').trim().slice(0, 24) || el.tagName) + '@' + Math.round(r.height) + 'px');
        }
      });
      return out;
    }''')
    rec('touch-targets-24px+', portal, len(small) == 0, f'small={small}')

    # 3. interactive elements reachable by keyboard (tabindex not negative on buttons; focus visible css)
    negtab = await page.evaluate('''() => {
      let n = 0;
      document.querySelectorAll('button[tabindex="-1"], a[tabindex="-1"]').forEach(() => n++);
      return n;
    }''')
    rec('no-keyboard-excluded-controls', portal, negtab == 0, f'neg={negtab}')

    # 4. images/icons conveying meaning have labels — sample: buttons with no text and no aria-label
    unlabeled = await page.evaluate('''() => {
      const out = [];
      document.querySelectorAll('button').forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t && !el.getAttribute('aria-label') && !el.getAttribute('title') && out.length < 5) out.push(el.outerHTML.slice(0, 60));
      });
      return out;
    }''')
    rec('buttons-labeled', portal, len(unlabeled) == 0, f'unlabeled={len(unlabeled)}')

    # 5. enter the quiz runner if possible and re-check overflow there
    try:
        start = await page.query_selector('button:has-text("Start Quiz"), button:has-text("Review weakest"), button:has-text("Smart cards")')
        if start:
            await start.click()
            await page.wait_for_timeout(1500)
            ro = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            rec('runner-no-overflow', portal, ro <= 1, f'overflow={ro}px errs={errs[:1]}')
        else:
            rec('runner-no-overflow', portal, True, 'no entry found — skipped')
    except Exception as e:
        rec('runner-no-overflow', portal, False, f'err={str(e)[:80]}')

    # 6. contrast sanity: body text vs background ratio approximated — skip deep, check font sizes not tiny
    tiny = await page.evaluate('''() => {
      let n = 0;
      document.querySelectorAll('p, span, div, button').forEach(el => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 10 && (el.textContent || '').trim().length > 10) n++;
      });
      return n;
    }''')
    rec('no-micro-text', portal, tiny < 4, f'tiny-blocks={tiny}')

    await b.close()

async def main():
    async with async_playwright() as pw:
        for p in PORTALS:
            await audit_portal(pw, p)
        # launchpad
        b = await pw.chromium.launch(args=['--no-sandbox'])
        page = await b.new_page(viewport={'width': 390, 'height': 844})
        await page.goto(BASE + '/', wait_until='domcontentloaded')
        await page.wait_for_timeout(2200)
        overflow = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        rec('no-horizontal-overflow', 'launchpad', overflow <= 1, f'overflow={overflow}px')
        await b.close()
    print(json.dumps(results, indent=1))

asyncio.run(main())
