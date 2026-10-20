import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APIRequestContext, Page, expect, request, test } from '@playwright/test';

/**
 * El recorrido de la demo contra el stack real y la cuenta del estudiante:
 * subir → ready → chat con citas → Studio (motor y Gemini) → lección → borrar.
 */

const API = process.env.E2E_API ?? 'http://localhost:3000/api';
const LIBRO = process.env.E2E_LIBRO ?? join(__dirname, 'libros', 'El principito.pdf');
const SESION = join(__dirname, '.auth', 'sesion.json');
const TITULO = 'El principito';

function tokenDeLaSesion(): string {
  const estado = JSON.parse(readFileSync(SESION, 'utf-8')) as {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
  const token = estado.origins.flatMap((o) => o.localStorage).find((e) => e.name === 'bookmind.token');
  if (!token) throw new Error('La sesión guardada no tiene token: vuelve a exportarla.');
  return token.value;
}

/** Enciende o apaga "Ayuda de Gemini" desde la interfaz, sin importar cómo estaba. */
async function ayudaGemini(page: Page, encendida: boolean): Promise<void> {
  const interruptor = page.getByRole('switch', { name: 'Ayuda de Gemini', exact: true });
  // Hasta que llega el estado del servidor está deshabilitado y marca "false": leerlo antes da una carrera.
  await expect(interruptor).toBeEnabled();
  if ((await interruptor.getAttribute('aria-checked')) !== String(encendida)) await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', String(encendida));
}

test.describe.serial('Recorrido de la demo con un libro real', () => {
  let api: APIRequestContext;
  let geminiAntes: { activada: boolean; disponible: boolean };
  let documentoId: string | null = null;

  test.beforeAll(async () => {
    test.skip(!existsSync(SESION), 'Falta e2e/.auth/sesion.json: exporta la sesión del navegador (ver CLAUDE.md, sección 4).');
    test.skip(!existsSync(LIBRO), `Falta el libro de prueba en ${LIBRO}.`);

    api = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${tokenDeLaSesion()}` } });
    const salud = await api.get(`${API}/health`).catch(() => null);
    test.skip(!salud?.ok(), 'El backend no responde en ' + API);

    geminiAntes = await (await api.get(`${API}/users/ayuda-gemini`)).json();
    // Si una corrida anterior se cortó, su copia del libro no debe confundir a esta.
    const libros = (await (await api.get(`${API}/documents`)).json()) as Array<{ id: string; title: string }>;
    for (const libro of libros.filter((l) => l.title === TITULO)) await api.delete(`${API}/documents/${libro.id}`);
  });

  test.afterAll(async () => {
    if (!api) return;
    // Pase lo que pase, la cuenta queda como estaba: el interruptor igual y sin el libro de prueba.
    await api.put(`${API}/users/ayuda-gemini`, { data: { activada: geminiAntes.activada } });
    if (documentoId) await api.delete(`${API}/documents/${documentoId}`);
    await api.dispose();
  });

  test('subir: el libro se procesa y el clasificador entrenado detecta su materia', async ({ page }) => {
    await page.goto('/subir');
    await page.locator('input[type=file]').setInputFiles(LIBRO);

    await expect(page.getByText('Materia detectada')).toBeVisible({ timeout: 3 * 60_000 });
    await expect(page.getByText('Comunicación y Lenguaje')).toBeVisible();

    await page.getByRole('button', { name: 'Abrir el libro' }).click();
    await expect(page).toHaveURL(/\/lector\/[0-9a-f-]{36}$/);
    documentoId = page.url().split('/').pop()!;
  });

  test('chat sin Gemini: responde con frases del libro y cada cita abre su página', async ({ page }) => {
    await page.goto(`/lector/${documentoId}`);
    await ayudaGemini(page, false);

    const pregunta = page.getByRole('textbox', { name: 'Escribe tu pregunta' });
    await pregunta.fill('¿Qué le pide el principito al aviador que dibuje?');
    await pregunta.press('Enter');

    await expect(page.getByText('Respuesta armada con pasajes del libro por el motor propio, sin IA externa.')).toBeVisible();
    await expect(page.getByText(/Respaldado por el libro/)).toBeVisible();

    const cita = page.getByRole('region', { name: 'Chat' }).getByRole('button', { name: /^pág\. \d+$/ }).first();
    const pagina = (await cita.textContent())!.match(/\d+/)![0];
    await cita.click();
    await expect(page.getByRole('spinbutton', { name: 'Ir a la página' })).toHaveValue(pagina);
  });

  test('Studio solo con el motor: resumen por capítulos y quiz, con su origen a la vista', async ({ page }) => {
    await page.goto(`/lector/${documentoId}`);
    await ayudaGemini(page, false);
    const studio = page.getByRole('complementary', { name: 'Studio' });

    await studio.getByRole('button', { name: 'Generar Resumen' }).click();
    await expect(studio.getByText(/\d+ secciones · \d+ ideas/)).toBeVisible({ timeout: 2 * 60_000 });
    await expect(studio.getByText('Motor propio · sin IA externa').first()).toBeVisible();

    await studio.getByRole('button', { name: 'Generar Quiz' }).click();
    await expect(studio.getByText(/\d+ preguntas/)).toBeVisible({ timeout: 2 * 60_000 });
  });

  test('Studio con Gemini: el motor arma y Gemini redacta, o el motor responde solo si Gemini falla', async ({ page }) => {
    test.skip(!geminiAntes.disponible, 'El servidor no tiene Gemini configurado.');
    await page.goto(`/lector/${documentoId}`);
    await ayudaGemini(page, true);
    const studio = page.getByRole('complementary', { name: 'Studio' });

    await studio.getByRole('button', { name: 'Generar Flashcards' }).click();
    const origen = studio.getByText(/^\s*Motor propio · (redactado con Gemini|sin IA externa)\s*$/).first();
    await expect(origen).toBeVisible({ timeout: 2 * 60_000 });
    // Que Gemini falle no es un error del sistema: se registra para saber qué se vio en la corrida.
    const etiqueta = (await origen.textContent())!.trim();
    test.info().annotations.push({ type: 'origen de las flashcards', description: etiqueta });
    console.log(`Flashcards: ${etiqueta}`);
  });

  test('mapa mental con Gemini: se dibuja legible en el panel y se abre en grande', async ({ page }) => {
    test.skip(!geminiAntes.disponible, 'El servidor no tiene Gemini configurado.');
    await page.goto(`/lector/${documentoId}`);
    await ayudaGemini(page, true);
    const studio = page.getByRole('complementary', { name: 'Studio' });

    await studio.getByRole('button', { name: 'Generar Mapa mental' }).click();
    const dibujo = studio.locator('app-diagrama .diagrama__svg');
    // Gemini saturado no es un error del sistema: el mapa depende de él y el aviso lo explica.
    const resultado = await Promise.race([
      dibujo.waitFor({ timeout: 2 * 60_000 }).then(() => 'mapa' as const),
      page.getByRole('alert').filter({ hasText: /Gemini|modelo/i }).waitFor({ timeout: 2 * 60_000 }).then(() => 'gemini no respondió' as const),
    ]);
    test.info().annotations.push({ type: 'mapa mental', description: resultado });
    if (resultado !== 'mapa') return;

    expect(await studio.locator('app-diagrama .nodo').count()).toBeGreaterThanOrEqual(4);
    // En el panel va en árbol con sangría: no se desborda ni queda diminuto.
    const panel = (await studio.boundingBox())!;
    const mapa = (await dibujo.boundingBox())!;
    expect(mapa.width).toBeLessThanOrEqual(panel.width);

    await studio.getByRole('button', { name: 'Ver en grande' }).click();
    const grande = page.locator('dialog.ampliado[open]');
    await expect(grande.locator('.diagrama__svg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(grande).toHaveCount(0);
  });

  test('lección: se completa desde la ruta y suma XP y racha', async ({ page }) => {
    await page.goto('/progreso');
    await page.getByRole('tab', { name: TITULO, exact: true }).click();
    await page.getByRole('button', { name: /^Unidad 1:/ }).click();
    await page.getByRole('dialog', { name: 'Unidad 1' }).getByRole('button').click();
    await expect(page).toHaveURL(/\/leccion\//);

    // Responde siempre la primera opción: interesa el flujo, no la nota.
    for (let paso = 0; paso < 20; paso += 1) {
      await page.locator('button.opcion').first().click();
      await page.getByRole('button', { name: 'Comprobar' }).click();
      const siguiente = page.getByRole('button', { name: /^(Continuar|Terminar)$/ });
      const terminar = (await siguiente.textContent())!.includes('Terminar');
      await siguiente.click();
      if (terminar) break;
    }

    await expect(page.getByText('XP ganado')).toBeVisible();
    await expect(page.locator('.tarjeta-final--xp')).toContainText(/\+\d+/);
    await expect(page.getByText(/Racha de \d+ días?/)).toBeVisible();
  });

  test('borrar: el libro desaparece de la biblioteca y la API ya no lo entrega', async ({ page }) => {
    await page.goto('/biblioteca');
    await page.getByRole('button', { name: `Eliminar ${TITULO}`, exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByRole('heading', { name: TITULO, exact: true })).toHaveCount(0);

    expect((await api.get(`${API}/documents/${documentoId}`)).status()).toBe(404);
    expect((await api.get(`${API}/documents/${documentoId}/file`)).status()).toBe(404);
    documentoId = null;
  });
});
