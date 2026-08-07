// ==========================================================================
// Utilidades globales de AgroLink Honduras
// ==========================================================================

import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { ALLOWED_IMAGE_MIMES, WEAK_PASSWORDS } from '../constants';

/**
 * Filtro de multer: rechaza el archivo antes de bufferearlo por completo si el
 * mimetype declarado por el cliente no corresponde a una imagen permitida.
 * Primera línea de defensa; el contenido real se verifica luego por bytes en StorageService.
 */
export function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    callback(null, false);
    return;
  }
  callback(null, true);
}

/**
 * Genera un slug a partir de un texto
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Eliminar caracteres especiales
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Guiones múltiples a uno
    .trim();
}

/**
 * Calcula la distancia entre dos coordenadas geográficas (Haversine)
 * Retorna la distancia en kilómetros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Sanitiza un string para prevenir XSS básico
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Sin acentos, en minúsculas, sin espacios al borde — para comparar texto sin que un acento cambie el resultado. */
function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/** 4+ repeticiones seguidas del mismo carácter ("aaaa", "1111"). */
function hasRepeatedRun(password: string): boolean {
  return /(.)\1{3,}/.test(password);
}

// Fragmentos de 4 caracteres de patrones de teclado/secuencias obvias — se
// busca cada ventana de 4 (y su reverso, por si la escriben al revés) como
// substring de la contraseña. No hace falta la lista completa de teclado,
// con las filas más tecleadas alcanza para atrapar los casos reales.
const SEQUENTIAL_PATTERNS = [
  '0123456789',
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

function hasObviousSequence(password: string): boolean {
  const lower = password.toLowerCase();
  for (const pattern of SEQUENTIAL_PATTERNS) {
    for (let i = 0; i <= pattern.length - 4; i++) {
      const chunk = pattern.slice(i, i + 4);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(''))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Reglas de contraseña que un `@Matches` del DTO no puede cubrir solo,
 * porque necesitan contexto (quién es el usuario) o una lista externa —
 * `STRONG_PASSWORD_REGEX` ya validó longitud/mayúscula/minúscula/número/
 * símbolo antes de llegar aquí. Se llama desde `AuthService` en los 4
 * lugares donde se fija una contraseña (registro comprador/vendedor, reset,
 * cambio), pasando el nombre/correo/negocio del usuario como `contextValues`.
 * Lanza `BadRequestException` con un mensaje en español lista-para-mostrar
 * si la contraseña es insegura por alguno de estos motivos.
 */
export function assertPasswordIsSafe(
  password: string,
  contextValues: Array<string | null | undefined>,
): void {
  const foldedPassword = foldText(password);

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    throw new BadRequestException('Esa contraseña es demasiado común. Elige una diferente.');
  }

  for (const raw of contextValues) {
    if (!raw) continue;
    // Para el correo, solo la parte antes del @; para el nombre, cada
    // palabra suelta ("María Fernández" bloquea "maria..." y "fernandez...").
    const pieces = raw.includes('@') ? [raw.split('@')[0]] : raw.split(/\s+/);
    for (const piece of pieces) {
      const folded = foldText(piece);
      // Fragmentos muy cortos (2-3 letras) se ignoran — si no, cualquier
      // nombre corto bloquearía coincidencias sin sentido real.
      if (folded.length < 4) continue;
      if (foldedPassword.includes(folded)) {
        throw new BadRequestException('La contraseña no debe contener tu nombre ni tu correo electrónico.');
      }
    }
  }

  if (hasRepeatedRun(password)) {
    throw new BadRequestException('La contraseña no debe repetir el mismo carácter varias veces seguidas.');
  }

  if (hasObviousSequence(password)) {
    throw new BadRequestException('La contraseña no debe usar secuencias obvias como "1234" o "abcd".');
  }
}
