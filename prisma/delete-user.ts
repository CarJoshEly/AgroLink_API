// ==========================================================================
// Borra por completo un usuario de prueba (y su perfil de vendedor si
// tiene), para poder volver a registrarte con el mismo correo. El borrado
// directo desde el editor de tablas de Supabase falla por la FK
// seller_profiles_userId_fkey (SellerProfile.user es Restrict, a propósito,
// para no perder vendedores con actividad real por accidente) — este script
// borra en el orden correcto dentro de una transacción.
//
// Uso:
//   npx ts-node prisma/delete-user.ts correo@ejemplo.com
// ==========================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: npx ts-node prisma/delete-user.ts correo@ejemplo.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { sellerProfile: true },
  });

  if (!user) {
    console.log(`No existe ningún usuario con el correo ${email}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (user.sellerProfile) {
      // IdentityVerification se borra solo (Cascade desde sellerProfile).
      await tx.sellerProfile.delete({ where: { id: user.sellerProfile.id } });
    }
    // Location/RefreshToken/Cart/Favorite/Notification son Cascade desde
    // User; AuditLog pasa a userId null (SetNull) — no hace falta tocarlos.
    await tx.user.delete({ where: { id: user.id } });
  });

  console.log(`Usuario ${email} (${user.role}) eliminado por completo.`);
}

main()
  .catch((error) => {
    console.error(
      '\nNo se pudo eliminar. Si el error menciona una tabla como "products", "orders" u ' +
        '"seller_reviews", esta cuenta ya tiene actividad real (productos publicados, pedidos, ' +
        'reseñas) y hay que decidir qué hacer con esos registros antes de borrarla.\n',
    );
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
