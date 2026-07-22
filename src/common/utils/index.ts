// ==========================================================================
// Utilidades globales de AgroLink Honduras
// ==========================================================================

import type { Request } from 'express';
import { ALLOWED_IMAGE_MIMES } from '../constants';

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
