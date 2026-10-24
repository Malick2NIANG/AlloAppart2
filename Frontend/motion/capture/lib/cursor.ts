import type { Page } from '@playwright/test';

// Curseur de toucher simulé — PLAN_CAPTURE.md § 3. Injecté uniquement dans
// la page du navigateur de capture (`addInitScript`), jamais dans le code
// de l'application : rond 44px CSS, liseré or, onde au moment de l'appui,
// léger rétrécissement pendant l'appui. `pointer-events: none` pour ne
// jamais intercepter les vrais clics du script.
export async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    function install() {
      if (!document.documentElement) { document.addEventListener('DOMContentLoaded', install, { once: true }); return; }
      if (document.getElementById('__capture-cursor-style')) return;

      const style = document.createElement('style');
      style.id = '__capture-cursor-style';
      style.textContent = STYLE_TEXT;
      document.documentElement.appendChild(style);

      const el = document.createElement('div');
      el.id = '__capture-cursor';
      el.innerHTML = '<div class="__wave"></div>';
      el.style.display = 'none';
      document.documentElement.appendChild(el);

      (window as unknown as { __captureCursor: typeof el }).__captureCursor = el;
    }

    const STYLE_TEXT = `
      #__capture-cursor {
        position: fixed; left: 0; top: 0; width: 44px; height: 44px;
        margin-left: -22px; margin-top: -22px; border-radius: 50%;
        background: rgba(255,255,255,0.3); border: 2px solid #facc15;
        pointer-events: none; z-index: 2147483647;
        transition: transform 120ms ease-out;
        box-shadow: 0 0 0 0 rgba(250,204,21,0.6);
      }
      #__capture-cursor.pressed { transform: scale(0.82); }
      #__capture-cursor .__wave {
        position: absolute; inset: -2px; border-radius: 50%;
        border: 2px solid #facc15; opacity: 0;
      }
      #__capture-cursor.wave .__wave {
        animation: __capture-cursor-wave 450ms ease-out;
      }
      @keyframes __capture-cursor-wave {
        from { opacity: 0.9; transform: scale(1); }
        to   { opacity: 0;   transform: scale(2.6); }
      }
    `;

    install();
  });
}

async function cursorEl(page: Page) {
  return page.evaluateHandle(() => (window as unknown as { __captureCursor: HTMLElement }).__captureCursor);
}

/** Déplace le curseur simulé en 20-30 pas avec accélération/décélération (§ 3). */
export async function moveCursorTo(page: Page, x: number, y: number, fromX?: number, fromY?: number): Promise<void> {
  const handle = await cursorEl(page);
  await handle.evaluate((el) => { (el as HTMLElement).style.display = 'block'; });

  const steps = 24;
  const start = fromX !== undefined && fromY !== undefined ? { x: fromX, y: fromY } : { x, y };
  for (let i = 1; i <= steps; i++) {
    // Ease-in-out cubique — accélère puis décélère, comme un vrai geste.
    const t = i / steps;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const cx = start.x + (x - start.x) * eased;
    const cy = start.y + (y - start.y) * eased;
    await page.mouse.move(cx, cy);
    await handle.evaluate((el, pos) => {
      (el as HTMLElement).style.transform = `translate(${pos.cx}px, ${pos.cy}px)`;
    }, { cx, cy });
    await page.waitForTimeout(12);
  }
  // Pause avant l'appui — le spectateur doit voir où l'on va appuyer (§ 3).
  await page.waitForTimeout(320);
}

/** Simule un appui (onde dorée + rétrécissement) à la position courante du curseur. */
export async function pressCursor(page: Page): Promise<void> {
  const handle = await cursorEl(page);
  await handle.evaluate((el) => {
    const e = el as HTMLElement;
    e.classList.add('pressed', 'wave');
    setTimeout(() => e.classList.remove('wave'), 480);
  });
  await page.waitForTimeout(120);
  await handle.evaluate((el) => (el as HTMLElement).classList.remove('pressed'));
}

/** Clique un élément avec le curseur simulé visible : déplace, appuie, clique réellement. */
export async function tapAt(page: Page, x: number, y: number, fromX?: number, fromY?: number): Promise<void> {
  await moveCursorTo(page, x, y, fromX, fromY);
  await pressCursor(page);
  await page.mouse.click(x, y);
}

/** Défilement progressif, courbe douce, jamais de saut (§ 3). */
export async function smoothScrollBy(page: Page, deltaY: number, durationMs = 900): Promise<void> {
  const steps = 30;
  const perStep = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, perStep);
    await page.waitForTimeout(durationMs / steps);
  }
}
