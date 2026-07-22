import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

export type PrismaMock = DeepMockProxy<PrismaClient>;

/** Crea un mock profundo de PrismaClient para pruebas unitarias (sin tocar la base de datos real). */
export function createPrismaMock(): PrismaMock {
  return mockDeep<PrismaClient>();
}
