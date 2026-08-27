import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archivoEnv = resolve(raiz, '.env');
const destino = resolve(raiz, 'src', 'environments', 'environment.generated.ts');

const variables = existsSync(archivoEnv)
  ? dotenv.parse(readFileSync(archivoEnv))
  : {};

const apiUrl = variables.API_URL ?? process.env.API_URL ?? 'http://localhost:3000/api';
const googleClientId =
  variables.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';

const contenido = `// Archivo generado desde .env. No editar manualmente.\n` +
  `export const environmentValues = ${JSON.stringify({ apiUrl, googleClientId }, null, 2)} as const;\n`;

writeFileSync(destino, contenido, 'utf8');
console.log(`Environment generado en ${destino}`);
