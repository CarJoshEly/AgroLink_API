import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('AgroLink Honduras API')
  .setDescription(
    'API REST del Marketplace Agrícola de Honduras. ' +
    'Conectando el ecosistema agrícola hondureño.',
  )
  .setVersion('1.0')
  .setContact(
    'AgroLink Honduras',
    'https://agrolink.hn',
    'soporte@agrolink.hn',
  )
  .setLicense('UNLICENSED', '')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Ingresa tu token JWT',
      in: 'header',
    },
    'access-token',
  )
  .addTag('Health', 'Verificación del estado del sistema')
  .addTag('Auth', 'Autenticación y autorización')
  .addTag('Users', 'Gestión de usuarios')
  .addTag('Sellers', 'Gestión de vendedores')
  .addTag('Categories', 'Gestión de categorías')
  .addTag('Products', 'Gestión de productos')
  .addTag('Cart', 'Carrito de compras')
  .addTag('Orders', 'Gestión de pedidos')
  .addTag('Reviews', 'Reseñas y reputación')
  .addTag('Favorites', 'Productos y vendedores favoritos')
  .addTag('Reports', 'Reportes de contenido')
  .addTag('Notifications', 'Notificaciones del sistema')
  .addTag('Locations', 'Ubicaciones geográficas')
  .addTag('Admin', 'Panel de administración')
  .addTag('Finance', 'Arquitectura financiera: pagos, comisiones y transacciones')
  .build();
