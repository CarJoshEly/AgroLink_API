import { BadRequestException } from '@nestjs/common';
import { assertPasswordIsSafe, generateSlug } from './index';

describe('assertPasswordIsSafe', () => {
  it('no lanza para una contraseña fuerte sin relación con el contexto', () => {
    expect(() =>
      assertPasswordIsSafe('Xk9#mQ2!vB', ['María Fernández', 'maria@example.com']),
    ).not.toThrow();
  });

  it('rechaza una contraseña de la lista de comunes (case-insensitive)', () => {
    expect(() => assertPasswordIsSafe('Password1!', [])).toThrow(BadRequestException);
    expect(() => assertPasswordIsSafe('PASSWORD1!', [])).toThrow(BadRequestException);
  });

  it('rechaza si la contraseña contiene el nombre del usuario', () => {
    expect(() => assertPasswordIsSafe('Roberto2024!', ['Roberto Cruz', 'otro@example.com'])).toThrow(
      BadRequestException,
    );
  });

  it('rechaza si la contraseña contiene un apellido (palabra suelta del nombre)', () => {
    expect(() => assertPasswordIsSafe('Fernandez2024!', ['María Fernández', 'maria@example.com'])).toThrow(
      BadRequestException,
    );
  });

  it('rechaza si la contraseña contiene la parte local del correo', () => {
    expect(() => assertPasswordIsSafe('Mfernandez24!', ['Otro Nombre', 'mfernandez@example.com'])).toThrow(
      BadRequestException,
    );
  });

  it('ignora coincidencias triviales con fragmentos cortos (nombres de 2-3 letras)', () => {
    // "Ana" y "Li" son demasiado cortos para bloquear por sí solos.
    expect(() => assertPasswordIsSafe('Xk9#mQliAn', ['Ana Li', 'ana@example.com'])).not.toThrow();
  });

  it('ignora nombre/correo nulos o vacíos sin lanzar', () => {
    expect(() => assertPasswordIsSafe('Xk9#mQ2!vB', [null, undefined, ''])).not.toThrow();
  });

  it('rechaza 4 o más repeticiones seguidas del mismo carácter', () => {
    expect(() => assertPasswordIsSafe('Xaaaa2024!', [])).toThrow(BadRequestException);
  });

  it('rechaza secuencias numéricas obvias', () => {
    expect(() => assertPasswordIsSafe('Xk9!abcd1234', [])).toThrow(BadRequestException);
  });

  it('rechaza secuencias de teclado obvias', () => {
    expect(() => assertPasswordIsSafe('Xk9!qwerty', [])).toThrow(BadRequestException);
  });

  it('no distingue acentos al comparar contra el nombre', () => {
    // "María" sin tilde igual debe bloquear si el usuario se llama "María".
    expect(() => assertPasswordIsSafe('maria2024!X', ['María Fernández', 'x@example.com'])).toThrow(
      BadRequestException,
    );
  });
});

// Cobertura mínima existente para `generateSlug` — no la tocamos, solo
// confirma que el archivo sigue exportando lo que ya exportaba antes de
// agregar `assertPasswordIsSafe`.
describe('generateSlug', () => {
  it('normaliza acentos, minúsculas y espacios a guiones', () => {
    expect(generateSlug('Tomate Riñón  Especial')).toBe('tomate-rinon-especial');
  });
});
