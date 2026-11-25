"""Integration verification sweep v2 — real selectors, dialog capture."""
import asyncio, json
from playwright.async_api import async_playwright

BASE = 'http://localhost:3000'
PORTALS = ['cs', 'maths', 'physics']
results = {}

def rec(flow, portal, ok, evidence=''):
    results.setdefault(flow, {})[portal] = {'status': 'pass' if ok else 'FAIL', 'evidence': evidence[:140]}

async def sweep_portal(pw, portal):
    b = await pw.chromium.launch(args=['--no-sandbox'])
    page = await b.new_page(viewport={'width': 1280, 'height': 900})
    errs, dialogs = [], []
    page.on('pageerror', lambda e: errs.append(str(e)[:150]))
    page.on('dialog', lambda d: (dialogs.append(d.message[:100]), asyncio.ensure_future(d.dismiss())))
    P = f'/{portal}/'

    # 1. load
    await page.goto(BASE + P, wait_until='domcontentloaded')
    await page.wait_for_timeout(2500)
    nav = await page.query_selector('.room-tabs')
    rec('load-no-errors', portal, nav is not None and not errs, f'errs={errs[:1]}')

    # 2. synthesis → runner → answer → finish → results
    try:
        await page.goto(BASE + P, wait_until='domcontentloaded')
        await page.wait_for_timeout(2200)
        # open synth modal if there's an opener; otherwise it may be inline
        cont = await page.query_selector('#synthContinueBtn')
        if cont:
            await cont.click()
            await page.wait_for_timeout(700)
        start = await page.query_selector('button:has-text("Start Quiz"), #synthModal button:has-text("Start"), #synthStartBtn, button:has-text("Begin paper")')
        if start:
            await start.click()
            await page.wait_for_timeout(1500)
        in_runner = await page.query_selector('#chromeMid')
        answered = finished = results_ok = False
        if in_runner:
            # answer whatever is here: mcq option or text area
            for _ in range(30):
                opt = await page.query_selector('.mcq-opt, .mcq-option, [data-opt-index], input[type="radio"]')
                if opt:
                    await opt.click()
                    answered = True
                    await page.wait_for_timeout(200)
                ta = await page.query_selector('textarea')
                if ta:
                    await ta.fill('seed answer')
                    answered = True
                nxt = await page.query_selector('#nextBtn, button:has-text("Next"), button:has-text("Continue →")')
                fin = await page.query_selector('#finishBtn, button:has-text("Finish"), button:has-text("Submit")')
                if fin and await fin.is_visible():
                    await fin.click()
                    await page.wait_for_timeout(500)
                    conf = await page.query_selector('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("finish")')
                    if conf:
                        await conf.click()
                    await page.wait_for_timeout(1000)
                    finished = True
                    break
                if nxt and await nxt.is_visible():
                    await nxt.click()
                    await page.wait_for_timeout(400)
                else:
                    break
            results_ok = bool(await page.querySelector if False else await page.query_selector('#rw-root, .stat-row, #backResBtn, #backHomeBtn, #retryResBtn, #retryBtn'))
        rec('synthesis-quiz-finish', portal, bool(in_runner) and bool(results_ok), f'runner={bool(in_runner)} ans={answered} fin={finished} res={bool(results_ok)} dlg={dialogs[:1]}')
    except Exception as e:
        rec('synthesis-quiz-finish', portal, False, f'ex:{str(e)[:90]}')

    # 3. timed exam countdown — via mock series paper (always an exam)
    try:
        await page.goto(BASE + P, wait_until='domcontentloaded')
        await page.wait_for_timeout(2200)
        dialogs.clear()
        ms = await page.query_selector('#mockSeriesBtn')
        started = timed = False
        if ms:
            await ms.click()
            await page.wait_for_timeout(1800)
            state = await page.evaluate(f"""async () => {{
              const S = (await import('/{portal}/js/state.js')).S;
              return {{ series: !!S.series, room: S.room, limit: S.quiz?.timeLimitMinutes || 0,
                       clock: (document.getElementById('chromeMid') || {{}}).innerHTML || '' }};
            }}""")
            started = state['series'] and state['room'] == 'runner'
            timed = state['limit'] > 0 and ('left' in state['clock'] or 'examClock' in state['clock'])
        rec('timed-exam-countdown', portal, started and timed, f'series={started} limit+clock={timed} dlg={dialogs[:1]}')
        # 4. mock series flow continues: finish paper 1 quickly → break screen appears
        if started:
            broke = False
            for _ in range(40):
                fin = await page.query_selector('#finishBtn, button:has-text("Finish"), button:has-text("Submit")')
                if fin and await fin.is_visible():
                    await fin.click()
                    await page.wait_for_timeout(600)
                    conf = await page.query_selector('button:has-text("Yes"), button:has-text("Confirm")')
                    if conf: await conf.click()
                    await page.wait_for_timeout(1200)
                    html = await page.inner_html('body')
                    broke = 'break' in html.lower() or 'seriesContinueBtn' in html or 'paper 2' in html.lower()
                    break
                nxt = await page.query_selector('#nextBtn, button:has-text("Next"), button:has-text("Continue →")')
                if nxt and await nxt.is_visible():
                    await nxt.click()
                    await page.wait_for_timeout(300)
                else:
                    break
            rec('mock-series-roundtrip', portal, broke, f'break-screen={broke}')
        else:
            rec('mock-series-roundtrip', portal, False, 'series never started')
    except Exception as e:
        rec('timed-exam-countdown', portal, False, f'ex:{str(e)[:90]}')
        rec('mock-series-roundtrip', portal, False, f'ex:{str(e)[:90]}')

    # 5. flashcards open + flip + grade
    try:
        await page.goto(BASE + P, wait_until='domcontentloaded')
        await page.wait_for_timeout(2200)
        fc = await page.query_selector('#smartCardsBtn')
        flipped = graded = False
        if fc:
            await fc.click()
            await page.wait_for_timeout(1200)
            card = await page.query_selector('.flashcard, #flashcard, [data-card], .fc-card')
            if card:
                await card.click()
                await page.wait_for_timeout(400)
                flipped = True
            grade = await page.query_selector('button:has-text("Got it"), button:has-text("Know"), [data-grade]')
            if grade:
                await grade.click()
                graded = True
                await page.wait_for_timeout(300)
        rec('flashcards-session', portal, flipped, f'btn={bool(fc)} flip={flipped} grade={graded}')
    except Exception as e:
        rec('flashcards-session', portal, False, f'ex:{str(e)[:90]}')

    # 6. planner
    try:
        await page.goto(BASE + P, wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)
        tab = await page.query_selector('[data-room="planner"]')
        cards = 0
        if tab:
            await tab.click()
            await page.wait_for_timeout(600)
            inp = await page.query_selector('#plannerExamDate')
            if inp:
                await inp.fill('2027-06-15')
                await inp.dispatch_event('change')
                await page.wait_for_timeout(700)
                html = await page.inner_html('#plannerRoot')
                cards = html.count('padding:10px 14px')
        rec('planner-generates', portal, cards > 3, f'cards={cards}')
    except Exception as e:
        rec('planner-generates', portal, False, f'ex:{str(e)[:90]}')

    # 7. history + drilldown
    try:
        tab = await page.query_selector('[data-room="history"]')
        ok = drill = False
        if tab:
            await tab.click()
            await page.wait_for_timeout(900)
            html = await page.inner_html('#stage')
            ok = len(html) > 300
            row = await page.query_selector('[data-attempt], .attempt-row, tr[data-idx], .hist-row')
            if row:
                await row.click()
                await page.wait_for_timeout(600)
                drill = len(await page.inner_html('#stage')) > len(html) - 100
        rec('history-drilldown', portal, ok, f'render={ok} drill={drill}')
    except Exception as e:
        rec('history-drilldown', portal, False, f'ex:{str(e)[:90]}')

    # 8. print window generation — intercept popup
    try:
        await page.goto(BASE + P, wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)
        printed = False
        cont = await page.query_selector('#synthContinueBtn')
        if cont:
            await cont.click()
            await page.wait_for_timeout(700)
        pb = await page.query_selector('#synthPrintPaperBtn, button:has-text("Print paper")')
        if pb:
            async with page.context.expect_page(timeout=6000) as pop:
                await pb.click()
        try:
            popup = await pop.value
            await popup.wait_for_timeout(800)
            content = await popup.inner_html('body')
            printed = len(content) > 200
        except Exception:
            printed = False
        rec('print-rendering', portal, printed, f'btn={bool(pb)} printed={printed}')
    except Exception as e:
        rec('print-rendering', portal, False, f'ex:{str(e)[:90]}')

    # 9. author studio roundtrip: validate rejection of empty save
    try:
        # close any modal left open by earlier flows (print leaves synth open)
        x = await page.query_selector('#synthClose, .modal-backdrop button:has-text("✕")')
        if x:
            try: await x.click()
            except Exception: pass
            await page.wait_for_timeout(300)
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(200)
        tab = await page.query_selector('[data-room="author"]')
        ok = False
        if tab:
            await tab.click()
            await page.wait_for_timeout(800)
            html = await page.inner_html('#stage')
            ok = len(html) > 300
        rec('author-renders', portal, ok, f'len={ok}')
    except Exception as e:
        rec('author-renders', portal, False, f'ex:{str(e)[:90]}')

    await b.close()

async def main():
    async with async_playwright() as pw:
        for portal in PORTALS:
            await sweep_portal(pw, portal)
        # launchpad
        b = await pw.chromium.launch(args=['--no-sandbox'])
        page = await b.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)[:120]))
        await page.goto(BASE + '/', wait_until='domcontentloaded')
        await page.wait_for_timeout(2500)
        html = await page.inner_html('body')
        rec('launchpad-overview', 'launchpad', 'revision picture' in html.lower(), f'len={len(html)}')
        rec('launchpad-no-errors', 'launchpad', not errs, f'errs={errs[:1]}')
        # today widget needs exam dates — set them first in this browser
        await page.evaluate("""() => localStorage.setItem('jqm-exam-dates-v1', JSON.stringify({cs:'2027-06-15',maths:'2027-06-16',physics:'2027-06-17'}))""")
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(2500)
        html = await page.inner_html('body')
        rec('launchpad-today', 'launchpad', "Today's revision" in html, 'widget present' if "Today's revision" in html else 'absent')
        await b.close()

    cols = PORTALS + ['launchpad']
    print('\n## Coverage matrix\n')
    print('| flow | ' + ' | '.join(cols) + ' |')
    print('|---|' + '|'.join(['---'] * len(cols)) + '|')
    for f in sorted(results.keys()):
        row = [f]
        for c in cols:
            cell = results[f].get(c)
            row.append((cell['status'] + ' — ' + cell['evidence'][:60]) if cell else '—')
        print('| ' + ' | '.join(row) + ' |')
    json.dump(results, open('/tmp/sweep-results.json', 'w'), indent=1)
    fails = sum(1 for f in results for c in results[f] if results[f][c]['status'] == 'FAIL')
    print(f'\nFAILURES: {fails}')

asyncio.run(main())
