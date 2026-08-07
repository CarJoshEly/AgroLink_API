// ==========================================================================
// Lista de contraseñas demasiado comunes — rechazadas aunque cumplan el
// patrón de `STRONG_PASSWORD_REGEX` (mayúscula/minúscula/número/símbolo no
// sirve de nada si la contraseña completa es "Password1!", que está en
// cualquier diccionario de ataque). No pretende ser exhaustiva — es una
// mezcla de las más comunes en filtraciones conocidas (inglés), variantes en
// español, y algunas obvias para el contexto de AgroLink/Honduras. La
// comparación en `assertPasswordIsSafe` es case-insensitive.
// ==========================================================================

export const WEAK_PASSWORDS: ReadonlySet<string> = new Set(
  [
    // Secuencias numéricas
    '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
    '22222222', '123123123', '12341234', '654321', '111222333', '01234567',

    // Clásicos en inglés
    'password', 'password1', 'password123', 'passw0rd', 'p@ssword', 'p@ssw0rd',
    'letmein', 'letmein123', 'welcome', 'welcome1', 'welcome123', 'admin123',
    'iloveyou', 'iloveyou1', 'princess', 'football', 'baseball', 'basketball',
    'dragon', 'master', 'monkey', 'monkey123', 'sunshine', 'shadow', 'superman',
    'trustno1', 'whatever', 'freedom', 'ninja', 'mustang', 'access', 'flower',
    'loveme', 'harley', 'ranger', 'buster', 'soccer', 'hockey', 'killer',
    'jordan23', 'computer', 'batman', 'corvette', 'jordan', 'cheese', 'blahblah',
    'starwars', 'tinker', 'minecraft', 'qazwsx', 'qwerty', 'qwerty123',
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1q2w3e4r', 'abcd1234', 'a1b2c3d4',
    'changeme', 'changeit', 'default', 'guest', 'test1234', 'temp1234',

    // Variantes en español / Latinoamérica
    'contraseña', 'contrasena', 'contraseña123', 'contrasena123', 'micontrasena',
    'cambiar123', 'hola1234', 'holamundo', 'holamundo123', 'usuario123',
    'correo123', 'milagro', 'corazon', 'teamo1234', 'bendecido', 'futbol123',
    'campeon123', 'amorcito', 'mifamilia', '12345678a', 'contraseñasegura',
    'clave1234', 'micuenta123', 'nuevaclave', 'password1234',

    // Ligados al contexto de la app — lo primero que probaría cualquiera
    'agrolink', 'agrolink123', 'agrolink1', 'honduras123', 'tegucigalpa123',
    'comprador123', 'vendedor123', 'agricultor123',

    // Variantes que SÍ cumplen mayúscula+minúscula+número+símbolo (pasarían
    // `STRONG_PASSWORD_REGEX` sin este bloqueo aparte) — el patrón "Palabra
    // + números + símbolo" es el primero que prueba cualquier diccionario de
    // ataque en cuanto un sitio exige complejidad.
    'password1!', 'password123!', 'p@ssword1', 'p@ssw0rd1', 'welcome123!',
    'qwerty123!', 'abcd1234!', 'iloveyou1!',
    'contraseña123!', 'contrasena123!', 'clave1234!',
    'agrolink123!', 'agrolink1!', 'honduras123!',
  ].map((p) => p.toLowerCase()),
);
