// ==========================================================================
// Crea (o actualiza) un único usuario ADMIN, sin tocar el resto de la base
// de datos. `seed.ts` genera ~120,000 registros de prueba — no es lo que
// hace falta cuando solo se necesita una cuenta para entrar al panel de
// verificación de vendedores.
//
// Uso:
//   npx ts-node prisma/create-admin.ts
//   ADMIN_EMAIL=otro@correo.com ADMIN_PASSWORD=OtraClave123 npx ts-node prisma/create-admin.ts
// ==========================================================================

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@agrolink.hn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AgroLinkAdmin2026!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador AgroLink';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      // Se marca ya verificado: un admin no pasa por el flujo de
      // verificación de correo que sí aplica a compradores/vendedores.
      emailVerifiedAt: new Date(),
    },
  });

  console.log('\nCuenta admin lista:');
  console.log(`  email:    ${admin.email}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log('\nInicia sesión en http://localhost:3001/login con esas credenciales.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
