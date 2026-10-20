import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Browser, Page, expect, request, test } from '@playwright/test';

/**
 * Capturas para el video de lanzamiento: pantalla completa, piezas sueltas con su posición
 * y un "fondo" sin esas piezas, para que el video las arme una por una.
 * Solo lee la cuenta; lo único que deja es una sesión de chat nueva (y XP si se pide la lección final).
 */

const API = process.env.E2E_API ?? 'http://localhost:3000/api';
const SESION = join(__dirname, '..', 'e2e', '.auth', 'sesion.json');
const SALIDA = join(__dirname, '..', '..', 'video-lanzamiento', 'capturas');
const PREGUNTA = '¿Qué le pide el principito al aviador que dibuje?';

type Caja = { x: number; y: number; w: number; h: number; i?: number };
const manifiesto: Record<string, { piezas: Record<string, Caja[]>; extra?: Record<string, Caja> }> = {};

const SIN_MOVIMIENTO = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

function tokenDeLaSesion(): string {
  const estado = JSON.parse(readFileSync(SESION, 'utf-8')) as {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
  return estado.origins.flatMap((o) => o.localStorage).find((e) => e.name === 'bookmind.token')!.value;
}

async function nuevaPagina(browser: Browser, tema: 'claro' | 'oscuro', conSesion = true): Promise<Page> {
  const contexto = await browser.newContext({
    baseURL: process.env.E2E_URL ?? 'http://localhost:4200',
    storageState: conSesion ? SESION : undefined,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  // El tema vive en localStorage: se fija en esta copia sin tocar el navegador real.
  await contexto.addInitScript((t) => localStorage.setItem('bookmind.tema', t), tema);
  return contexto.newPage();
}

async function quieta(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: SIN_MOVIMIENTO });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function caja(page: Page, selector: string, ultimo = false): Promise<Caja | null> {
  const todos = page.locator(selector);
  const b = await (ultimo ? todos.last() : todos.first()).boundingBox();
  return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
}

/** Pantalla completa + cada pieza recortada + el fondo con las piezas ocultas. */
async function capturar(page: Page, nombre: string, piezas: Record<string, string> = {}): Promise<void> {
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`) });
  const registro: Record<string, Caja[]> = {};
  for (const [pieza, selector] of Object.entries(piezas)) {
    registro[pieza] = [];
    const elementos = await page.locator(selector).all();
    for (const [i, el] of elementos.entries()) {
      const b = await el.boundingBox();
      // Solo lo que se ve entero: recortar de la pantalla no desplaza la página (el.screenshot sí).
      if (!b || b.width < 4 || b.y < 0 || b.y + b.height > 1080) continue;
      await page.screenshot({ path: join(SALIDA, `${nombre}__${pieza}_${i}.png`), clip: { x: b.x, y: b.y, width: b.width, height: b.height } });
      registro[pieza].push({ x: b.x, y: b.y, w: b.width, h: b.height, i });
    }
  }
  if (Object.keys(piezas).length) {
    const estilo = await page.addStyleTag({ content: `${Object.values(piezas).join(', ')} { visibility: hidden !important; }` });
    await page.screenshot({ path: join(SALIDA, `${nombre}__fondo.png`) });
    await estilo.evaluate((e) => (e as unknown as { remove(): void }).remove());
  }
  manifiesto[nombre] = { ...(manifiesto[nombre] ?? {}), piezas: registro };
}

test.describe.serial('Capturas para el video', () => {
  let libroId = '';
  let titulo = '';

  test.beforeAll(async () => {
    mkdirSync(SALIDA, { recursive: true });
    const api = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${tokenDeLaSesion()}` } });
    const libros = (await (await api.get(`${API}/documents`)).json()) as Array<{ id: string; title: string }>;
    const elegido = libros.find((l) => /principito/i.test(l.title)) ?? libros[0];
    expect(elegido, 'La cuenta necesita al menos un libro procesado').toBeTruthy();
    libroId = elegido.id;
    titulo = elegido.title;
    await api.dispose();
  });

  test.afterAll(() => {
    writeFileSync(join(SALIDA, 'capturas.json'), JSON.stringify({ libro: titulo, pantallas: manifiesto }, null, 2));
  });

  test('entrar', async ({ browser }) => {
    const page = await nuevaPagina(browser, 'claro', false);
    await page.goto('/entrar');
    await quieta(page);
    await capturar(page, 'entrar');
  });

  test('biblioteca clara y oscura', async ({ browser }) => {
    const page = await nuevaPagina(browser, 'claro');
    await page.goto('/biblioteca');
    await expect(page.locator('.tarjeta:not(.tarjeta--esqueleto)').first()).toBeVisible();
    await quieta(page);
    await capturar(page, 'biblioteca', {
      encabezado: '.encabezado',
      metrica: '.metrica',
      seguir: '.seguir',
      tarjeta: '.tarjeta:not(.tarjeta--esqueleto)',
    });
    manifiesto.biblioteca.extra = { tema: (await caja(page, '.tema'))! };

    const oscura = await nuevaPagina(browser, 'oscuro');
    await oscura.goto('/biblioteca');
    await expect(oscura.locator('.tarjeta:not(.tarjeta--esqueleto)').first()).toBeVisible();
    await quieta(oscura);
    await capturar(oscura, 'biblioteca-oscuro');
  });

  test('subir y asistente', async ({ browser }) => {
    const page = await nuevaPagina(browser, 'claro');
    await page.goto('/subir');
    await quieta(page);
    await capturar(page, 'subir');
    await page.goto('/asistente');
    await quieta(page);
    await capturar(page, 'asistente');
  });

  test('lector: chat vacío, pregunta escrita y respuesta con citas', async ({ browser }) => {
    const page = await nuevaPagina(browser, 'claro');
    await page.goto(`/lector/${libroId}`);
    const gemini = page.getByRole('region', { name: 'Chat' }).getByRole('switch', { name: 'Ayuda de Gemini', exact: true });
    if ((await gemini.getAttribute('aria-checked')) !== 'false') await gemini.click();
    await page.getByRole('button', { name: 'Nueva', exact: true }).click();
    await quieta(page);
    await capturar(page, 'lector-vacio', { sugerencia: '.sugerencia', artefacto: '.artefacto' });
    const entrada = page.getByRole('textbox', { name: 'Escribe tu pregunta' });
    const b = (await entrada.boundingBox())!;
    manifiesto['lector-vacio'].extra = { entrada: { x: b.x, y: b.y, w: b.width, h: b.height } };

    await entrada.fill(PREGUNTA);
    await entrada.press('Enter');
    await expect(page.getByText('Respuesta armada con pasajes del libro por el motor propio, sin IA externa.')).toBeVisible({ timeout: 2 * 60_000 });
    await quieta(page);
    await capturar(page, 'lector-respuesta', {
      usuario: '.turno--usuario',
      ia: '.turno--ia',
    });
    manifiesto['lector-respuesta'].extra = {
      respaldo: (await caja(page, '.turno--ia .pie-respuesta', true))!,
      paginas: (await caja(page, '.turno--ia .paginas', true))!,
    };
  });

  test('progreso y lección', async ({ browser }) => {
    const page = await nuevaPagina(browser, 'claro');
    await page.goto('/progreso');
    await page.getByRole('tab', { name: titulo }).click();
    await quieta(page);
    await capturar(page, 'progreso', { widget: '.widget', nodo: '.nodo' });

    await page.getByRole('button', { name: /^Unidad 1:/ }).click();
    await page.getByRole('dialog', { name: 'Unidad 1' }).getByRole('button').click();
    await expect(page).toHaveURL(/\/leccion\//);
    await quieta(page);
    await capturar(page, 'leccion', { opcion: 'button.opcion' });
    await page.locator('button.opcion').first().click();
    await capturar(page, 'leccion-elegida');

    // Terminar la lección suma XP de verdad: solo si se pide.
    if (process.env.CAPTURAR_FINAL === '1') {
      for (let paso = 0; paso < 20; paso += 1) {
        if (paso > 0) await page.locator('button.opcion').first().click();
        await page.getByRole('button', { name: 'Comprobar' }).click();
        const siguiente = page.getByRole('button', { name: /^(Continuar|Terminar)$/ });
        const terminar = (await siguiente.textContent())!.includes('Terminar');
        await siguiente.click();
        if (terminar) break;
      }
      await expect(page.getByText('XP ganado')).toBeVisible();
      await quieta(page);
      await capturar(page, 'leccion-final');
    }
  });
});
