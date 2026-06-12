import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('PAGE ERROR:', msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    console.error('PAGE EXCEPTION:', err.message);
  });

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    if (!bodyHTML.trim() || bodyHTML.includes('id="root"')) {
        const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
        if (!rootHtml?.trim()) {
            console.log('Page is totally blank (root is empty).');
        } else {
            console.log('Root has content:', rootHtml.substring(0, 100));
        }
    }
  } catch (err) {
    console.error('Navigation error:', err.message);
  } finally {
    await browser.close();
  }
})();
