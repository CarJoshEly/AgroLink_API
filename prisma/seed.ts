// ==========================================================================
// AgroLink Honduras Marketplace — Seed de datos realistas (Sprint 2)
// Genera un dataset coherente de ~120,000+ registros distribuidos entre
// todas las tablas, simulando un marketplace agrícola con ~18 meses de uso.
// ==========================================================================

import {
  PrismaClient,
  UserRole,
  VerificationStatus,
  ProductStatus,
  ProductUnit,
  CartStatus,
  OrderStatus,
  ReviewModerationStatus,
  ReportTargetType,
  ReportStatus,
  NotificationType,
  PaymentProvider,
  TransactionStatus,
} from '@prisma/client';
import { fakerES_MX as faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// --------------------------------------------------------------------------
// CONFIGURACIÓN
// --------------------------------------------------------------------------

const BATCH_SIZE = 2000;
const MONTHS_OF_HISTORY = 18;
const SEED_PASSWORD = 'AgroLink2026!';
const SUPABASE_BUCKET_URL =
  'https://scltsoeawmlpmwmvhykd.supabase.co/storage/v1/object/public/data';

const TARGET_COUNTS = {
  users: 6000, // 5 ADMIN / 600 SELLER / resto BUYER
  sellers: 600,
  admins: 5,
  buyerLocations: 1500,
  products: 6000,
  carts: 3000,
  favorites: 8000,
  orders: 15000,
  transactions: 40,
};

// --------------------------------------------------------------------------
// HELPERS GENÉRICOS
// --------------------------------------------------------------------------

function uuid(): string {
  return randomUUID();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDecimal(min: number, max: number, decimals = 2): number {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function weightedPick<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.weight) return it.value;
    r -= it.weight;
  }
  return items[items.length - 1].value;
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600 * 1000);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400 * 1000);
}

/** Fecha dentro de los últimos `monthsBack` meses, con una curva de
 * crecimiento: los meses recientes tienen más probabilidad (simula
 * adopción orgánica de la plataforma en el tiempo). */
function growthDate(monthsBack: number, now: Date): Date {
  const weights: number[] = [];
  let total = 0;
  for (let i = 0; i < monthsBack; i++) {
    const w = i + 1;
    weights.push(w);
    total += w;
  }
  let r = Math.random() * total;
  let idx = 0;
  for (; idx < monthsBack; idx++) {
    if (r < weights[idx]) break;
    r -= weights[idx];
  }
  const monthsAgo = monthsBack - 1 - idx;
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const endRaw = new Date(
    now.getFullYear(),
    now.getMonth() - monthsAgo + 1,
    1,
  );
  const end = endRaw.getTime() > now.getTime() ? now.getTime() : endRaw.getTime();
  const t = start.getTime() + Math.random() * Math.max(0, end - start.getTime());
  return new Date(t);
}

function biasedScore(): number {
  const r = Math.random();
  if (r < 0.55) return 5;
  if (r < 0.8) return 4;
  if (r < 0.92) return 3;
  if (r < 0.97) return 2;
  return 1;
}

async function batchCreate<T>(
  label: string,
  data: T[],
  run: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await run(data.slice(i, i + BATCH_SIZE));
  }
  console.log(`  ✓ ${label}: ${data.length} filas`);
}

// --------------------------------------------------------------------------
// DATOS GEOGRÁFICOS REALES DE HONDURAS
// --------------------------------------------------------------------------

// Lista oficial completa (298 municipios) — códigos administrativos del
// Instituto Nacional de Estadística de Honduras. Antes solo traía 4-6
// municipios "representativos" por departamento (85 en total); un vendedor
// de cualquier otro municipio no tenía forma de registrarse.
const DEPARTMENTS: { name: string; code: string; municipalities: [string, string][] }[] = [
  {
    name: 'Atlántida',
    code: '01',
    municipalities: [
      ['0101', 'La Ceiba'], ['0102', 'El Porvenir'], ['0103', 'Esparta'], ['0104', 'Jutiapa'],
      ['0105', 'La Masica'], ['0106', 'San Francisco'], ['0107', 'Tela'], ['0108', 'Arizona'],
    ],
  },
  {
    name: 'Colón',
    code: '02',
    municipalities: [
      ['0201', 'Trujillo'], ['0202', 'Balfate'], ['0203', 'Iriona'], ['0204', 'Limón'],
      ['0205', 'Sabá'], ['0206', 'Santa Fe'], ['0207', 'Santa Rosa de Aguán'], ['0208', 'Sonaguera'],
      ['0209', 'Tocoa'], ['0210', 'Bonito Oriental'],
    ],
  },
  {
    name: 'Comayagua',
    code: '03',
    municipalities: [
      ['0301', 'Comayagua'], ['0302', 'Ajuterique'], ['0303', 'El Rosario'], ['0304', 'Esquías'],
      ['0305', 'Humuya'], ['0306', 'La Libertad'], ['0307', 'Lamaní'], ['0308', 'La Trinidad'],
      ['0309', 'Lejamaní'], ['0310', 'Meámbar'], ['0311', 'Minas de Oro'], ['0312', 'Ojos de Agua'],
      ['0313', 'San Jerónimo'], ['0314', 'San José de Comayagua'], ['0315', 'San José del Potrero'],
      ['0316', 'San Luis'], ['0317', 'San Sebastián'], ['0318', 'Siguatepeque'],
      ['0319', 'Villa de San Antonio'], ['0320', 'Las Lajas'], ['0321', 'Taulabé'],
    ],
  },
  {
    name: 'Copán',
    code: '04',
    municipalities: [
      ['0401', 'Santa Rosa de Copán'], ['0402', 'Cabañas'], ['0403', 'Concepción'], ['0404', 'Copán Ruinas'],
      ['0405', 'Corquín'], ['0406', 'Cucuyagua'], ['0407', 'Dolores'], ['0408', 'Dulce Nombre'],
      ['0409', 'El Paraíso'], ['0410', 'Florida'], ['0411', 'La Jigua'], ['0412', 'La Unión'],
      ['0413', 'Nueva Arcadia'], ['0414', 'San Agustín'], ['0415', 'San Antonio'], ['0416', 'San Jerónimo'],
      ['0417', 'San José'], ['0418', 'San Juan de Opoa'], ['0419', 'San Nicolás'], ['0420', 'San Pedro'],
      ['0421', 'Santa Rita'], ['0422', 'Trinidad de Copán'], ['0423', 'Veracruz'],
    ],
  },
  {
    name: 'Cortés',
    code: '05',
    municipalities: [
      ['0501', 'San Pedro Sula'], ['0502', 'Choloma'], ['0503', 'Omoa'], ['0504', 'Pimienta'],
      ['0505', 'Potrerillos'], ['0506', 'Puerto Cortés'], ['0507', 'San Antonio de Cortés'],
      ['0508', 'San Francisco de Yojoa'], ['0509', 'San Manuel'], ['0510', 'Santa Cruz de Yojoa'],
      ['0511', 'Villanueva'], ['0512', 'La Lima'],
    ],
  },
  {
    name: 'Choluteca',
    code: '06',
    municipalities: [
      ['0601', 'Choluteca'], ['0602', 'Apacilagua'], ['0603', 'Concepción de María'], ['0604', 'Duyure'],
      ['0605', 'El Corpus'], ['0606', 'El Triunfo'], ['0607', 'Marcovia'], ['0608', 'Morolica'],
      ['0609', 'Namasigüe'], ['0610', 'Orocuina'], ['0611', 'Pespire'], ['0612', 'San Antonio de Flores'],
      ['0613', 'San Isidro'], ['0614', 'San José'], ['0615', 'San Marcos de Colón'],
      ['0616', 'Santa Ana de Yusguare'],
    ],
  },
  {
    name: 'El Paraíso',
    code: '07',
    municipalities: [
      ['0701', 'Yuscarán'], ['0702', 'Alauca'], ['0703', 'Danlí'], ['0704', 'El Paraíso'],
      ['0705', 'Güinope'], ['0706', 'Jacaleapa'], ['0707', 'Liure'], ['0708', 'Morocelí'],
      ['0709', 'Oropolí'], ['0710', 'Potrerillos'], ['0711', 'San Antonio de Flores'], ['0712', 'San Lucas'],
      ['0713', 'San Matías'], ['0714', 'Soledad'], ['0715', 'Teupasenti'], ['0716', 'Texiguat'],
      ['0717', 'Vado Ancho'], ['0718', 'Yauyupe'], ['0719', 'Trojes'],
    ],
  },
  {
    name: 'Francisco Morazán',
    code: '08',
    municipalities: [
      ['0801', 'Distrito Central'], ['0802', 'Alubarén'], ['0803', 'Cedros'], ['0804', 'Curarén'],
      ['0805', 'El Porvenir'], ['0806', 'Guaimaca'], ['0807', 'La Libertad'], ['0808', 'La Venta'],
      ['0809', 'Lepaterique'], ['0810', 'Maraita'], ['0811', 'Marale'], ['0812', 'Nueva Armenia'],
      ['0813', 'Ojojona'], ['0814', 'Orica'], ['0815', 'Reitoca'], ['0816', 'Sabanagrande'],
      ['0817', 'San Antonio de Oriente'], ['0818', 'San Buenaventura'], ['0819', 'San Ignacio'],
      ['0820', 'San Juan de Flores'], ['0821', 'San Miguelito'], ['0822', 'Santa Ana'],
      ['0823', 'Santa Lucía'], ['0824', 'Talanga'], ['0825', 'Tatumbla'], ['0826', 'Valle de Ángeles'],
      ['0827', 'Villa de San Francisco'], ['0828', 'Vallecillo'],
    ],
  },
  {
    name: 'Gracias a Dios',
    code: '09',
    municipalities: [
      ['0901', 'Puerto Lempira'], ['0902', 'Brus Laguna'], ['0903', 'Ahuas'],
      ['0904', 'Juan Francisco Bulnes'], ['0905', 'Ramón Villeda Morales'], ['0906', 'Wampusirpe'],
    ],
  },
  {
    name: 'Intibucá',
    code: '10',
    municipalities: [
      ['1001', 'La Esperanza'], ['1002', 'Camasca'], ['1003', 'Colomoncagua'], ['1004', 'Concepción'],
      ['1005', 'Dolores'], ['1006', 'Intibucá'], ['1007', 'Jesús de Otoro'], ['1008', 'Magdalena'],
      ['1009', 'Masaguara'], ['1010', 'San Antonio'], ['1011', 'San Isidro'], ['1012', 'San Juan'],
      ['1013', 'San Marcos de la Sierra'], ['1014', 'San Miguel Guancapla'], ['1015', 'Santa Lucía'],
      ['1016', 'Yamaranguila'], ['1017', 'San Francisco de Opalaca'],
    ],
  },
  {
    name: 'Islas de la Bahía',
    code: '11',
    municipalities: [
      ['1101', 'Roatán'], ['1102', 'Guanaja'], ['1103', 'José Santos Guardiola'], ['1104', 'Utila'],
    ],
  },
  {
    name: 'La Paz',
    code: '12',
    municipalities: [
      ['1201', 'La Paz'], ['1202', 'Aguanqueterique'], ['1203', 'Cabañas'], ['1204', 'Cane'],
      ['1205', 'Chinacla'], ['1206', 'Guajiquiro'], ['1207', 'Lauterique'], ['1208', 'Marcala'],
      ['1209', 'Mercedes de Oriente'], ['1210', 'Opatoro'], ['1211', 'San Antonio del Norte'],
      ['1212', 'San José'], ['1213', 'San Juan'], ['1214', 'San Pedro de Tutule'], ['1215', 'Santa Ana'],
      ['1216', 'Santa Elena'], ['1217', 'Santa María'], ['1218', 'Santiago de Puringla'], ['1219', 'Yarula'],
    ],
  },
  {
    name: 'Lempira',
    code: '13',
    municipalities: [
      ['1301', 'Gracias'], ['1302', 'Belén'], ['1303', 'Candelaria'], ['1304', 'Cololaca'],
      ['1305', 'Erandique'], ['1306', 'Gualcince'], ['1307', 'Guarita'], ['1308', 'La Campa'],
      ['1309', 'La Iguala'], ['1310', 'Las Flores'], ['1311', 'La Unión'], ['1312', 'La Virtud'],
      ['1313', 'Lepaera'], ['1314', 'Mapulaca'], ['1315', 'Piraera'], ['1316', 'San Andrés'],
      ['1317', 'San Francisco'], ['1318', 'San Juan Guarita'], ['1319', 'San Manuel Colohete'],
      ['1320', 'San Rafael'], ['1321', 'San Sebastián'], ['1322', 'Santa Cruz'], ['1323', 'Talgua'],
      ['1324', 'Tambla'], ['1325', 'Tomalá'], ['1326', 'Valladolid'], ['1327', 'Virginia'],
      ['1328', 'San Marcos de Caiquín'],
    ],
  },
  {
    name: 'Ocotepeque',
    code: '14',
    municipalities: [
      ['1401', 'Nueva Ocotepeque'], ['1402', 'Belén Gualcho'], ['1403', 'Concepción'],
      ['1404', 'Dolores Merendón'], ['1405', 'Fraternidad'], ['1406', 'La Encarnación'],
      ['1407', 'La Labor'], ['1408', 'Lucerna'], ['1409', 'Mercedes'], ['1410', 'San Fernando'],
      ['1411', 'San Francisco del Valle'], ['1412', 'San Jorge'], ['1413', 'San Marcos'],
      ['1414', 'Santa Fe'], ['1415', 'Sensenti'], ['1416', 'Sinuapa'],
    ],
  },
  {
    name: 'Olancho',
    code: '15',
    municipalities: [
      ['1501', 'Juticalpa'], ['1502', 'Campamento'], ['1503', 'Catacamas'], ['1504', 'Concordia'],
      ['1505', 'Dulce Nombre de Culmí'], ['1506', 'El Rosario'], ['1507', 'Esquipulas del Norte'],
      ['1508', 'Gualaco'], ['1509', 'Guarizama'], ['1510', 'Guata'], ['1511', 'Guayape'], ['1512', 'Jano'],
      ['1513', 'La Unión'], ['1514', 'Mangulile'], ['1515', 'Manto'], ['1516', 'Salamá'],
      ['1517', 'San Esteban'], ['1518', 'San Francisco de Becerra'], ['1519', 'San Francisco de la Paz'],
      ['1520', 'Santa María del Real'], ['1521', 'Silca'], ['1522', 'Yocón'], ['1523', 'Patuca'],
    ],
  },
  {
    name: 'Santa Bárbara',
    code: '16',
    municipalities: [
      ['1601', 'Santa Bárbara'], ['1602', 'Arada'], ['1603', 'Atima'], ['1604', 'Azacualpa'],
      ['1605', 'Ceguaca'], ['1606', 'San José de las Colinas'], ['1607', 'Concepción del Norte'],
      ['1608', 'Concepción del Sur'], ['1609', 'Chinda'], ['1610', 'El Níspero'], ['1611', 'Gualala'],
      ['1612', 'Ilama'], ['1613', 'Macuelizo'], ['1614', 'Naranjito'], ['1615', 'Nuevo Celilac'],
      ['1616', 'Petoa'], ['1617', 'Protección'], ['1618', 'Quimistán'], ['1619', 'San Francisco de Ojuera'],
      ['1620', 'San Luis'], ['1621', 'San Marcos'], ['1622', 'San Nicolás'], ['1623', 'San Pedro Zacapa'],
      ['1624', 'Santa Rita'], ['1625', 'San Vicente Centenario'], ['1626', 'Trinidad'], ['1627', 'Las Vegas'],
      ['1628', 'Nueva Frontera'],
    ],
  },
  {
    name: 'Valle',
    code: '17',
    municipalities: [
      ['1701', 'Nacaome'], ['1702', 'Alianza'], ['1703', 'Amapala'], ['1704', 'Aramecina'],
      ['1705', 'Caridad'], ['1706', 'Goascorán'], ['1707', 'Langue'], ['1708', 'San Francisco de Coray'],
      ['1709', 'San Lorenzo'],
    ],
  },
  {
    name: 'Yoro',
    code: '18',
    municipalities: [
      ['1801', 'Yoro'], ['1802', 'Arenal'], ['1803', 'El Negrito'], ['1804', 'El Progreso'],
      ['1805', 'Jocón'], ['1806', 'Morazán'], ['1807', 'Olanchito'], ['1808', 'Santa Rita'],
      ['1809', 'Sulaco'], ['1810', 'Victoria'], ['1811', 'Yorito'],
    ],
  },
];

// --------------------------------------------------------------------------
// CATÁLOGO DE CATEGORÍAS Y PRECIOS DE REFERENCIA (Lempiras)
// --------------------------------------------------------------------------

type LeafCategory = {
  name: string;
  slug: string;
  unit: ProductUnit;
  priceMin: number;
  priceMax: number;
};

const CATEGORY_TREE: { name: string; slug: string; children: LeafCategory[] }[] = [
  {
    name: 'Granos Básicos', slug: 'granos-basicos', children: [
      { name: 'Maíz', slug: 'maiz', unit: ProductUnit.QQ, priceMin: 350, priceMax: 550 },
      { name: 'Frijol', slug: 'frijol', unit: ProductUnit.QQ, priceMin: 1400, priceMax: 2200 },
      { name: 'Arroz', slug: 'arroz', unit: ProductUnit.QQ, priceMin: 900, priceMax: 1300 },
      { name: 'Sorgo', slug: 'sorgo', unit: ProductUnit.QQ, priceMin: 300, priceMax: 450 },
    ],
  },
  {
    name: 'Frutas', slug: 'frutas', children: [
      { name: 'Piña', slug: 'pina', unit: ProductUnit.UNIT, priceMin: 15, priceMax: 35 },
      { name: 'Sandía', slug: 'sandia', unit: ProductUnit.UNIT, priceMin: 40, priceMax: 90 },
      { name: 'Mango', slug: 'mango', unit: ProductUnit.LB, priceMin: 5, priceMax: 12 },
      { name: 'Banano', slug: 'banano', unit: ProductUnit.BOX, priceMin: 150, priceMax: 300 },
      { name: 'Naranja', slug: 'naranja', unit: ProductUnit.BAG, priceMin: 80, priceMax: 150 },
      { name: 'Limón', slug: 'limon', unit: ProductUnit.LB, priceMin: 6, priceMax: 15 },
    ],
  },
  {
    name: 'Hortalizas', slug: 'hortalizas', children: [
      { name: 'Tomate', slug: 'tomate', unit: ProductUnit.LB, priceMin: 8, priceMax: 20 },
      { name: 'Cebolla', slug: 'cebolla', unit: ProductUnit.KG, priceMin: 10, priceMax: 22 },
      { name: 'Chile', slug: 'chile', unit: ProductUnit.LB, priceMin: 15, priceMax: 35 },
      { name: 'Repollo', slug: 'repollo', unit: ProductUnit.UNIT, priceMin: 10, priceMax: 25 },
      { name: 'Zanahoria', slug: 'zanahoria', unit: ProductUnit.LB, priceMin: 8, priceMax: 18 },
      { name: 'Papa', slug: 'papa', unit: ProductUnit.LB, priceMin: 10, priceMax: 20 },
    ],
  },
  {
    name: 'Café', slug: 'cafe', children: [
      { name: 'Café Pergamino', slug: 'cafe-pergamino', unit: ProductUnit.QQ, priceMin: 2500, priceMax: 3500 },
      { name: 'Café Oro', slug: 'cafe-oro', unit: ProductUnit.QQ, priceMin: 4500, priceMax: 6000 },
      { name: 'Café Tostado', slug: 'cafe-tostado', unit: ProductUnit.LB, priceMin: 90, priceMax: 160 },
    ],
  },
  {
    name: 'Ganadería y Lácteos', slug: 'ganaderia-lacteos', children: [
      { name: 'Leche', slug: 'leche', unit: ProductUnit.LITER, priceMin: 12, priceMax: 20 },
      { name: 'Queso', slug: 'queso', unit: ProductUnit.LB, priceMin: 45, priceMax: 70 },
      { name: 'Cuajada', slug: 'cuajada', unit: ProductUnit.LB, priceMin: 40, priceMax: 65 },
      { name: 'Carne de Res', slug: 'carne-de-res', unit: ProductUnit.LB, priceMin: 90, priceMax: 130 },
      { name: 'Carne de Cerdo', slug: 'carne-de-cerdo', unit: ProductUnit.LB, priceMin: 70, priceMax: 100 },
    ],
  },
  {
    name: 'Avicultura', slug: 'avicultura', children: [
      { name: 'Huevos', slug: 'huevos', unit: ProductUnit.BOX, priceMin: 90, priceMax: 140 },
      { name: 'Pollo', slug: 'pollo', unit: ProductUnit.LB, priceMin: 35, priceMax: 55 },
    ],
  },
  {
    name: 'Semillas e Insumos', slug: 'semillas-insumos', children: [
      { name: 'Semillas Certificadas', slug: 'semillas-certificadas', unit: ProductUnit.BAG, priceMin: 300, priceMax: 800 },
      { name: 'Fertilizantes', slug: 'fertilizantes', unit: ProductUnit.BAG, priceMin: 450, priceMax: 950 },
      { name: 'Agroquímicos', slug: 'agroquimicos', unit: ProductUnit.LITER, priceMin: 200, priceMax: 600 },
      { name: 'Herramientas', slug: 'herramientas', unit: ProductUnit.UNIT, priceMin: 150, priceMax: 1200 },
    ],
  },
  {
    name: 'Miel y Derivados', slug: 'miel-derivados', children: [
      { name: 'Miel de Abeja', slug: 'miel-de-abeja', unit: ProductUnit.LITER, priceMin: 180, priceMax: 320 },
      { name: 'Polen', slug: 'polen', unit: ProductUnit.LB, priceMin: 250, priceMax: 400 },
      { name: 'Propóleo', slug: 'propoleo', unit: ProductUnit.UNIT, priceMin: 120, priceMax: 300 },
    ],
  },
];

const PRODUCT_ADJECTIVES = [
  'Fresco', 'de Primera Calidad', 'Orgánico', 'Seleccionado', 'de Exportación',
  'del Valle', 'Artesanal', 'de Temporada', 'Premium', 'Cosecha Local',
];

function productDescription(catName: string, muniName: string, deptName: string): string {
  const templates = [
    `${catName} de excelente calidad, cultivado en ${muniName}, ${deptName}. Producto fresco directamente del productor.`,
    `Vendemos ${catName.toLowerCase()} de primera, cosechado en nuestra finca ubicada en ${muniName}. Entrega disponible en la zona.`,
    `${catName} seleccionado a mano, sin intermediarios. Cultivo tradicional hondureño proveniente de ${deptName}.`,
    `Producto agrícola de ${catName.toLowerCase()} garantizado. Cultivado con buenas prácticas agrícolas en ${muniName}, ${deptName}.`,
  ];
  return pick(templates);
}

const SELLER_POSITIVE_COMMENTS = [
  'El vendedor fue muy puntual y respondió rápido a mis mensajes.',
  'Buena atención y precio justo, volveré a comprarle a este vendedor.',
  'Todo perfecto, gracias por la atención y el seguimiento del pedido.',
  'Vendedor muy confiable, cumplió con los tiempos acordados.',
  'Excelente comunicación durante todo el proceso de compra.',
  'Muy buena experiencia con este vendedor, lo recomiendo.',
];
const SELLER_NEUTRAL_COMMENTS = [
  'El vendedor cumplió, aunque la respuesta a mensajes tardó un poco.',
  'Atención correcta, la comunicación pudo ser más fluida.',
  'Cumple con lo ofrecido, sin más comentarios sobre el vendedor.',
];
const SELLER_NEGATIVE_COMMENTS = [
  'El vendedor tardó demasiado en responder y coordinar la entrega.',
  'Hubo demora considerable de parte del vendedor.',
  'Poca comunicación por parte del vendedor durante el pedido.',
];

const PRODUCT_POSITIVE_COMMENTS = [
  'Excelente calidad, tal como se describe. Muy recomendado.',
  'El producto llegó fresco y bien empacado.',
  'Producto de primera, superó mis expectativas.',
  'Muy buena calidad, se nota que es producto fresco del campo.',
  'Justo lo que esperaba, producto en perfecto estado.',
  'Muy buena experiencia de compra, producto fresco y bien empacado.',
];
const PRODUCT_NEUTRAL_COMMENTS = [
  'El producto cumplió, aunque la entrega tardó un poco más de lo esperado.',
  'Buen producto, aunque esperaba un poco más de frescura.',
  'Cumple con lo ofrecido, sin más comentarios sobre el producto.',
];
const PRODUCT_NEGATIVE_COMMENTS = [
  'El producto llegó en peores condiciones de lo esperado.',
  'La calidad no era la que se mostraba en la publicación.',
  'La cantidad no coincidía exactamente con lo solicitado.',
];

function reviewComment(
  avgScore: number,
  pools: { positive: string[]; neutral: string[]; negative: string[] },
): string | null {
  if (Math.random() < 0.15) return null;
  if (avgScore >= 4) return pick(pools.positive);
  if (avgScore >= 3) return pick(pools.neutral);
  return pick(pools.negative);
}

const REPORT_REASONS = [
  'Contenido ofensivo',
  'Producto no coincide con la descripción',
  'Vendedor no responde',
  'Posible fraude',
  'Spam',
  'Lenguaje inapropiado',
];

// --------------------------------------------------------------------------
// GENERADORES DE IDENTIFICADORES ÚNICOS
// --------------------------------------------------------------------------

let dniCounter = 1;
function nextDni(deptCode: string): string {
  const muniSeq = String(randInt(1, 20)).padStart(2, '0');
  const year = randInt(1955, 2005);
  const seq = String(dniCounter++).padStart(5, '0');
  return `${deptCode}${muniSeq}-${year}-${seq}`;
}

function phoneNumber(): string {
  const prefix = pick(['3', '8', '9']);
  const rest = String(randInt(1000000, 9999999));
  return `${prefix}${rest}`;
}

async function main() {
  const now = new Date();
  console.log('\u{1F331} Iniciando seed de AgroLink Honduras Marketplace...\n');

  const existing = await prisma.department.count();
  if (existing > 0) {
    console.log(
      '⚠️  La base de datos ya contiene departamentos (> 0 filas). Abortando para evitar duplicar ~120k registros.',
    );
    console.log('   Si deseas volver a sembrar desde cero, vacía la base de datos primero.');
    return;
  }

  const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

  // ------------------------------------------------------------------------
  // 1. DEPARTAMENTOS Y MUNICIPIOS
  // ------------------------------------------------------------------------
  console.log('\u{1F4CD} Geografía...');

  const departmentRows = DEPARTMENTS.map((d) => ({
    id: uuid(),
    name: d.name,
    code: d.code,
  }));
  await batchCreate('departments', departmentRows, (c) =>
    prisma.department.createMany({ data: c }),
  );

  type MuniRef = { id: string; departmentId: string; name: string; departmentName: string };
  const municipalityRefs: MuniRef[] = [];
  const municipalityRows: {
    id: string;
    name: string;
    code: string;
    departmentId: string;
  }[] = [];

  DEPARTMENTS.forEach((d, di) => {
    const deptId = departmentRows[di].id;
    d.municipalities.forEach(([muniCode, muniName]) => {
      const id = uuid();
      municipalityRows.push({
        id,
        name: muniName,
        code: muniCode,
        departmentId: deptId,
      });
      municipalityRefs.push({ id, departmentId: deptId, name: muniName, departmentName: d.name });
    });
  });
  await batchCreate('municipalities', municipalityRows, (c) =>
    prisma.municipality.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 2. CATEGORÍAS
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4C2} Categorías...');

  const parentRows = CATEGORY_TREE.map((c) => ({
    id: uuid(),
    name: c.name,
    slug: c.slug,
    parentId: null as string | null,
    isActive: true,
  }));
  await batchCreate('categories (padres)', parentRows, (c) =>
    prisma.category.createMany({ data: c }),
  );

  type LeafRef = LeafCategory & { id: string };
  const leafCategories: LeafRef[] = [];
  const childRows: {
    id: string;
    name: string;
    slug: string;
    parentId: string;
    isActive: boolean;
  }[] = [];

  CATEGORY_TREE.forEach((parent, pi) => {
    const parentId = parentRows[pi].id;
    parent.children.forEach((leaf) => {
      const id = uuid();
      childRows.push({ id, name: leaf.name, slug: leaf.slug, parentId, isActive: true });
      leafCategories.push({ ...leaf, id });
    });
  });
  await batchCreate('categories (hijas)', childRows, (c) =>
    prisma.category.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 3. MÉTODOS DE PAGO
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4B3} Métodos de pago...');

  const paymentMethods = [
    { id: uuid(), name: 'PayPal', provider: PaymentProvider.PAYPAL, isActive: true },
    { id: uuid(), name: 'Tarjeta de Crédito', provider: PaymentProvider.CREDIT_CARD, isActive: true },
    { id: uuid(), name: 'Tarjeta de Débito', provider: PaymentProvider.DEBIT_CARD, isActive: true },
    { id: uuid(), name: 'Otro', provider: PaymentProvider.OTHER, isActive: false },
  ];
  await batchCreate('payment_methods', paymentMethods, (c) =>
    prisma.paymentMethod.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 4. USUARIOS
  // ------------------------------------------------------------------------
  console.log('\n\u{1F465} Usuarios...');

  type UserRef = { id: string; role: UserRole; createdAt: Date };
  const adminRefs: UserRef[] = [];
  const sellerUserRefs: UserRef[] = [];
  const buyerUserRefs: UserRef[] = [];
  const userRows: {
    id: string;
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  const emailDomains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
  let userSeq = 0;
  function buildUser(role: UserRole, createdAt: Date): UserRef {
    userSeq++;
    const name = faker.person.fullName();
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/(^\.|\.$)/g, '');
    const email = `${slug}${userSeq}@${pick(emailDomains)}`;
    const isActive = Math.random() > 0.03;
    const id = uuid();
    userRows.push({
      id,
      name,
      email,
      phone: phoneNumber(),
      passwordHash,
      role,
      isActive,
      createdAt,
      updatedAt: createdAt,
    });
    return { id, role, createdAt };
  }

  for (let i = 0; i < TARGET_COUNTS.admins; i++) {
    const createdAt = growthDate(MONTHS_OF_HISTORY, now);
    adminRefs.push(buildUser(UserRole.ADMIN, createdAt));
  }
  for (let i = 0; i < TARGET_COUNTS.sellers; i++) {
    const createdAt = growthDate(MONTHS_OF_HISTORY, now);
    sellerUserRefs.push(buildUser(UserRole.SELLER, createdAt));
  }
  const buyersToCreate = TARGET_COUNTS.users - TARGET_COUNTS.admins - TARGET_COUNTS.sellers;
  for (let i = 0; i < buyersToCreate; i++) {
    const createdAt = growthDate(MONTHS_OF_HISTORY, now);
    buyerUserRefs.push(buildUser(UserRole.CUSTOMER, createdAt));
  }

  await batchCreate('users', userRows, (c) => prisma.user.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 5. CONFIGURACIÓN DE COMISIONES (histórico)
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4B0} Configuración de comisiones...');

  const adminIds = adminRefs.map((a) => a.id);
  const commissionPercentages = [5.0, 6.0, 6.5, 7.0, 7.5];
  const commissionRows = commissionPercentages.map((pct, idx) => {
    const monthsAgo = MONTHS_OF_HISTORY - Math.round((idx * MONTHS_OF_HISTORY) / commissionPercentages.length);
    const effectiveFrom = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return {
      id: uuid(),
      percentage: pct,
      effectiveFrom,
      effectiveTo: idx < commissionPercentages.length - 1 ? undefined : undefined,
      isActive: idx === commissionPercentages.length - 1,
      createdBy: pick(adminIds),
    };
  });
  // effectiveTo del anterior = effectiveFrom del siguiente
  for (let i = 0; i < commissionRows.length - 1; i++) {
    (commissionRows[i] as any).effectiveTo = commissionRows[i + 1].effectiveFrom;
    (commissionRows[i] as any).isActive = false;
  }
  await batchCreate('commission_configs', commissionRows, (c) =>
    prisma.commissionConfig.createMany({ data: c as any }),
  );
  const currentCommissionPct = commissionPercentages[commissionPercentages.length - 1];

  // ------------------------------------------------------------------------
  // 6. UBICACIONES
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4CD} Ubicaciones...');

  type LocationInfo = { municipalityName: string; departmentName: string };
  const sellerLocationInfo = new Map<string, LocationInfo>();
  const locationRows: {
    id: string;
    userId: string;
    departmentId: string;
    municipalityId: string;
    address: string;
    latitude: number;
    longitude: number;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  function randomLatLng(): { lat: number; lng: number } {
    return { lat: randDecimal(13.0, 16.4, 6), lng: -randDecimal(83.2, 89.3, 6) };
  }

  sellerUserRefs.forEach((seller) => {
    const muni = pick(municipalityRefs);
    const { lat, lng } = randomLatLng();
    const createdAt = addHours(seller.createdAt, randInt(1, 72));
    locationRows.push({
      id: uuid(),
      userId: seller.id,
      departmentId: muni.departmentId,
      municipalityId: muni.id,
      address: `${faker.location.streetAddress()}, Barrio ${faker.person.lastName()}`,
      latitude: lat,
      longitude: lng,
      isPrimary: true,
      createdAt,
      updatedAt: createdAt,
    });
    sellerLocationInfo.set(seller.id, { municipalityName: muni.name, departmentName: muni.departmentName });
  });

  const buyersWithLocation = faker.helpers.arrayElements(
    buyerUserRefs,
    Math.min(TARGET_COUNTS.buyerLocations, buyerUserRefs.length),
  );
  buyersWithLocation.forEach((buyer) => {
    const muni = pick(municipalityRefs);
    const { lat, lng } = randomLatLng();
    const createdAt = addHours(buyer.createdAt, randInt(1, 200));
    locationRows.push({
      id: uuid(),
      userId: buyer.id,
      departmentId: muni.departmentId,
      municipalityId: muni.id,
      address: `${faker.location.streetAddress()}, Barrio ${faker.person.lastName()}`,
      latitude: lat,
      longitude: lng,
      isPrimary: true,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await batchCreate('locations', locationRows, (c) =>
    prisma.location.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 7. PERFILES DE VENDEDOR
  // ------------------------------------------------------------------------
  console.log('\n\u{1F3EA} Perfiles de vendedor...');

  const BUSINESS_PREFIXES = ['Finca', 'Agropecuaria', 'Cooperativa', 'Distribuidora', 'Granja'];

  type SellerRef = {
    id: string; // sellerProfile id
    userId: string;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  };
  const sellerRefs: SellerRef[] = [];
  const sellerProfileRows: {
    id: string;
    userId: string;
    businessName: string;
    dni: string;
    verificationStatus: VerificationStatus;
    verifiedAt: Date | null;
    verifiedBy: string | null;
    suspendedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[] = [];

  const statusPool = weightedPickPool([
    { value: VerificationStatus.VERIFIED, weight: 85 },
    { value: VerificationStatus.PENDING, weight: 5 },
    { value: VerificationStatus.UNDER_REVIEW, weight: 5 },
    { value: VerificationStatus.REJECTED, weight: 3 },
    { value: VerificationStatus.SUSPENDED, weight: 2 },
  ]);

  sellerUserRefs.forEach((seller) => {
    const deptCode = DEPARTMENTS[randInt(0, DEPARTMENTS.length - 1)].code;
    const status = statusPool();
    const createdAt = addHours(seller.createdAt, randInt(1, 48));
    const reviewedAt =
      status === VerificationStatus.PENDING ? null : addDays(createdAt, randInt(1, 10));
    const isClosed = Math.random() < 0.015;
    sellerProfileRows.push({
      id: (function () {
        const id = uuid();
        sellerRefs.push({ id, userId: seller.id, verificationStatus: status, createdAt });
        return id;
      })(),
      userId: seller.id,
      businessName: `${pick(BUSINESS_PREFIXES)} ${faker.person.lastName()}`,
      dni: nextDni(deptCode),
      verificationStatus: status,
      verifiedAt: status === VerificationStatus.VERIFIED ? reviewedAt : null,
      verifiedBy: reviewedAt ? pick(adminIds) : null,
      suspendedReason:
        status === VerificationStatus.SUSPENDED
          ? pick(['Documentación inconsistente', 'Reportes múltiples de compradores', 'Incumplimiento de pedidos'])
          : null,
      createdAt,
      updatedAt: reviewedAt ?? createdAt,
      deletedAt: isClosed ? addDays(reviewedAt ?? createdAt, randInt(30, 300)) : null,
    });
  });

  await batchCreate('seller_profiles', sellerProfileRows, (c) =>
    prisma.sellerProfile.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 8. VERIFICACIÓN DE IDENTIDAD
  // ------------------------------------------------------------------------
  console.log('\n\u{1F194} Verificaciones de identidad...');

  const identityRows: {
    id: string;
    sellerProfileId: string;
    dniFrontUrl: string;
    dniBackUrl: string;
    selfieUrl: string;
    lifeProofUrl: string;
    status: VerificationStatus;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }[] = [];

  sellerProfileRows.forEach((sp) => {
    // ~92% de vendedores ya subieron su documentación
    if (Math.random() > 0.92 && sp.verificationStatus === VerificationStatus.PENDING) return;
    const createdAt = addHours(sp.createdAt, randInt(1, 24));
    identityRows.push({
      id: uuid(),
      sellerProfileId: sp.id,
      dniFrontUrl: `${SUPABASE_BUCKET_URL}/identity/${sp.id}/dni-front.jpg`,
      dniBackUrl: `${SUPABASE_BUCKET_URL}/identity/${sp.id}/dni-back.jpg`,
      selfieUrl: `${SUPABASE_BUCKET_URL}/identity/${sp.id}/selfie.jpg`,
      lifeProofUrl: `${SUPABASE_BUCKET_URL}/identity/${sp.id}/life-proof.jpg`,
      status: sp.verificationStatus,
      reviewedBy: sp.verifiedBy,
      reviewedAt: sp.verifiedAt,
      createdAt,
    });
  });

  await batchCreate('identity_verifications', identityRows, (c) =>
    prisma.identityVerification.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 9. PRODUCTOS
  // ------------------------------------------------------------------------
  console.log('\n\u{1F33D} Productos...');

  type ProductRef = {
    id: string;
    sellerId: string;
    price: number;
    unit: ProductUnit;
    categoryId: string;
    deleted: boolean;
  };
  const productRefs: ProductRef[] = [];
  const productRows: {
    id: string;
    sellerId: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    unit: ProductUnit;
    stock: number;
    status: ProductStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[] = [];

  const productStatusPool = weightedPickPool([
    { value: ProductStatus.ACTIVE, weight: 90 },
    { value: ProductStatus.OUT_OF_STOCK, weight: 5 },
    { value: ProductStatus.INACTIVE, weight: 5 },
  ]);

  sellerRefs.forEach((seller) => {
    const count = randInt(3, 17);
    for (let i = 0; i < count; i++) {
      const leaf = pick(leafCategories);
      const price = randDecimal(leaf.priceMin, leaf.priceMax);
      const isDeleted = Math.random() < 0.02;
      const status = isDeleted ? ProductStatus.INACTIVE : productStatusPool();
      const stock = status === ProductStatus.OUT_OF_STOCK ? 0 : randInt(5, 500);
      const createdAt = addDays(seller.createdAt, randInt(0, 500));
      const clampedCreatedAt = createdAt.getTime() > now.getTime() ? now : createdAt;
      const info = sellerLocationInfo.get(seller.userId);
      const id = uuid();
      productRows.push({
        id,
        sellerId: seller.id,
        categoryId: leaf.id,
        name: `${leaf.name} ${pick(PRODUCT_ADJECTIVES)}`,
        description: productDescription(
          leaf.name,
          info?.municipalityName ?? 'Honduras',
          info?.departmentName ?? 'Honduras',
        ),
        price,
        unit: leaf.unit,
        stock,
        status,
        createdAt: clampedCreatedAt,
        updatedAt: clampedCreatedAt,
        deletedAt: isDeleted ? addDays(clampedCreatedAt, randInt(10, 200)) : null,
      });
      productRefs.push({ id, sellerId: seller.id, price, unit: leaf.unit, categoryId: leaf.id, deleted: isDeleted });
    }
  });

  await batchCreate('products', productRows, (c) => prisma.product.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 10. IMÁGENES DE PRODUCTO
  // ------------------------------------------------------------------------
  console.log('\n\u{1F5BC}️  Imágenes de producto...');

  const productImageRows: {
    id: string;
    productId: string;
    url: string;
    order: number;
    createdAt: Date;
  }[] = [];

  productRows.forEach((p) => {
    const count = randInt(1, 4);
    for (let i = 0; i < count; i++) {
      productImageRows.push({
        id: uuid(),
        productId: p.id,
        url: `${SUPABASE_BUCKET_URL}/products/${p.id}/${i + 1}.jpg`,
        order: i,
        createdAt: p.createdAt,
      });
    }
  });

  await batchCreate('product_images', productImageRows, (c) =>
    prisma.productImage.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 11. CARRITOS Y ARTÍCULOS DEL CARRITO
  // ------------------------------------------------------------------------
  console.log('\n\u{1F6D2} Carritos...');

  const activeProducts = productRefs.filter((p) => !p.deleted);
  const buyersWithCart = faker.helpers.arrayElements(
    buyerUserRefs,
    Math.min(TARGET_COUNTS.carts, buyerUserRefs.length),
  );

  const cartStatusPool = weightedPickPool([
    { value: CartStatus.ACTIVE, weight: 40 },
    { value: CartStatus.CONVERTED, weight: 20 },
    { value: CartStatus.ABANDONED, weight: 40 },
  ]);

  const cartRows: {
    id: string;
    userId: string;
    status: CartStatus;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  const cartItemRows: {
    id: string;
    cartId: string;
    productId: string;
    quantity: number;
    createdAt: Date;
  }[] = [];

  buyersWithCart.forEach((buyer) => {
    const createdAt = addDays(buyer.createdAt, randInt(0, 400));
    const clamped = createdAt.getTime() > now.getTime() ? now : createdAt;
    const cartId = uuid();
    cartRows.push({
      id: cartId,
      userId: buyer.id,
      status: cartStatusPool(),
      createdAt: clamped,
      updatedAt: clamped,
    });
    const itemCount = randInt(1, 4);
    const seen = new Set<string>();
    for (let i = 0; i < itemCount; i++) {
      const product = pick(activeProducts);
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      cartItemRows.push({
        id: uuid(),
        cartId,
        productId: product.id,
        quantity: randInt(1, 15),
        createdAt: clamped,
      });
    }
  });

  await batchCreate('carts', cartRows, (c) => prisma.cart.createMany({ data: c }));
  await batchCreate('cart_items', cartItemRows, (c) => prisma.cartItem.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 12. FAVORITOS
  // ------------------------------------------------------------------------
  console.log('\n❤️  Favoritos...');

  const favoriteRows: {
    id: string;
    userId: string;
    productId: string | null;
    sellerId: string | null;
    createdAt: Date;
  }[] = [];
  const seenFavorites = new Set<string>();

  for (let i = 0; i < TARGET_COUNTS.favorites; i++) {
    const buyer = pick(buyerUserRefs);
    const isProductFavorite = Math.random() < 0.7;
    const productId = isProductFavorite ? pick(activeProducts).id : null;
    const sellerId = isProductFavorite ? null : pick(sellerRefs).id;
    const key = `${buyer.id}:${productId ?? ''}:${sellerId ?? ''}`;
    if (seenFavorites.has(key)) continue;
    seenFavorites.add(key);
    const createdAt = addDays(buyer.createdAt, randInt(0, 500));
    favoriteRows.push({
      id: uuid(),
      userId: buyer.id,
      productId,
      sellerId,
      createdAt: createdAt.getTime() > now.getTime() ? now : createdAt,
    });
  }

  await batchCreate('favorites', favoriteRows, (c) => prisma.favorite.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 13. PEDIDOS Y ARTÍCULOS DE PEDIDO (la mayor parte del dataset)
  // ------------------------------------------------------------------------
  console.log('\n\u{1F6CD}️  Pedidos (esto es lo más pesado)...');

  const sellersWithProducts = new Map<string, ProductRef[]>();
  activeProducts.forEach((p) => {
    const arr = sellersWithProducts.get(p.sellerId) ?? [];
    arr.push(p);
    sellersWithProducts.set(p.sellerId, arr);
  });
  const eligibleSellerIds = [...sellersWithProducts.keys()];

  const orderStatusPool = weightedPickPool([
    { value: OrderStatus.DELIVERED, weight: 60 },
    { value: OrderStatus.CONFIRMED, weight: 15 },
    { value: OrderStatus.PREPARING, weight: 10 },
    { value: OrderStatus.PENDING, weight: 10 },
    { value: OrderStatus.CANCELLED, weight: 5 },
  ]);
  const itemCountPool = weightedPickPool([
    { value: 1, weight: 25 },
    { value: 2, weight: 35 },
    { value: 3, weight: 25 },
    { value: 4, weight: 15 },
  ]);

  type OrderRef = {
    id: string;
    buyerId: string;
    sellerId: string;
    status: OrderStatus;
    createdAt: Date;
    deliveredAt: Date | null;
    firstProductId: string;
    firstOrderItemId: string;
  };
  const orderRefs: OrderRef[] = [];
  const deliveredOrders: OrderRef[] = [];
  const cancelledOrders: OrderRef[] = [];
  const confirmedOrLaterOrders: OrderRef[] = [];

  const orderRows: {
    id: string;
    buyerId: string;
    sellerId: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
    confirmedAt: Date | null;
    deliveredAt: Date | null;
    cancelledAt: Date | null;
  }[] = [];
  const orderItemRows: {
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];

  for (let i = 0; i < TARGET_COUNTS.orders; i++) {
    const sellerId = pick(eligibleSellerIds);
    const sellerProducts = sellersWithProducts.get(sellerId)!;
    const buyer = pick(buyerUserRefs);
    const createdAt = growthDate(MONTHS_OF_HISTORY, now);
    const status = orderStatusPool();

    const desiredItems = Math.min(itemCountPool(), sellerProducts.length);
    const seen = new Set<string>();
    const items: { productId: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
    while (items.length < desiredItems) {
      const product = pick(sellerProducts);
      if (seen.has(product.id)) {
        if (seen.size >= sellerProducts.length) break;
        continue;
      }
      seen.add(product.id);
      const quantity = randInt(1, product.unit === ProductUnit.UNIT || product.unit === ProductUnit.BOX ? 10 : 25);
      const unitPrice = product.price;
      const subtotal = Number((unitPrice * quantity).toFixed(2));
      items.push({ productId: product.id, quantity, unitPrice, subtotal });
    }
    if (items.length === 0) continue;

    const totalAmount = Number(items.reduce((s, it) => s + it.subtotal, 0).toFixed(2));

    let confirmedAt: Date | null = null;
    let deliveredAt: Date | null = null;
    let cancelledAt: Date | null = null;
    let updatedAt = createdAt;

    if (status === OrderStatus.CANCELLED) {
      cancelledAt = addHours(createdAt, randInt(1, 48));
      updatedAt = cancelledAt;
    } else if (status !== OrderStatus.PENDING) {
      confirmedAt = addHours(createdAt, randInt(1, 24));
      updatedAt = confirmedAt;
      if (status === OrderStatus.DELIVERED) {
        deliveredAt = addDays(confirmedAt, randInt(1, 5));
        updatedAt = deliveredAt;
      }
    }
    if (updatedAt.getTime() > now.getTime()) updatedAt = now;
    if (deliveredAt && deliveredAt.getTime() > now.getTime()) deliveredAt = now;
    if (confirmedAt && confirmedAt.getTime() > now.getTime()) confirmedAt = now;
    if (cancelledAt && cancelledAt.getTime() > now.getTime()) cancelledAt = now;

    const orderId = uuid();
    orderRows.push({
      id: orderId,
      buyerId: buyer.id,
      sellerId,
      status,
      totalAmount,
      createdAt,
      updatedAt,
      confirmedAt,
      deliveredAt,
      cancelledAt,
    });
    let firstOrderItemId = '';
    items.forEach((it, idx) => {
      const itemId = uuid();
      if (idx === 0) firstOrderItemId = itemId;
      orderItemRows.push({
        id: itemId,
        orderId,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
      });
    });

    const ref: OrderRef = {
      id: orderId,
      buyerId: buyer.id,
      sellerId,
      status,
      createdAt,
      deliveredAt,
      firstProductId: items[0].productId,
      firstOrderItemId,
    };
    orderRefs.push(ref);
    if (status === OrderStatus.DELIVERED) deliveredOrders.push(ref);
    if (status === OrderStatus.CANCELLED) cancelledOrders.push(ref);
    if (status !== OrderStatus.PENDING && status !== OrderStatus.CANCELLED) confirmedOrLaterOrders.push(ref);
  }

  await batchCreate('orders', orderRows, (c) => prisma.order.createMany({ data: c }));
  await batchCreate('order_items', orderItemRows, (c) => prisma.orderItem.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 14. RESEÑAS
  // ------------------------------------------------------------------------
  console.log('\n⭐ Reseñas...');

  const reviewedOrders = faker.helpers.arrayElements(
    deliveredOrders,
    Math.round(deliveredOrders.length * 0.72),
  );
  const moderationPool = weightedPickPool([
    { value: ReviewModerationStatus.APPROVED, weight: 85 },
    { value: ReviewModerationStatus.PENDING_REVIEW, weight: 10 },
    { value: ReviewModerationStatus.REJECTED, weight: 5 },
  ]);

  const sellerReviewRows: {
    id: string;
    orderId: string;
    buyerId: string;
    sellerId: string;
    qualityScore: number;
    responseTimeScore: number;
    complianceScore: number;
    attentionScore: number;
    trustScore: number;
    comment: string | null;
    moderationStatus: ReviewModerationStatus;
    createdAt: Date;
  }[] = [];
  const productReviewRows: {
    id: string;
    orderId: string;
    orderItemId: string;
    productId: string;
    buyerId: string;
    rating: number;
    comment: string | null;
    moderationStatus: ReviewModerationStatus;
    createdAt: Date;
  }[] = [];

  reviewedOrders.forEach((order) => {
    const scores = {
      qualityScore: biasedScore(),
      responseTimeScore: biasedScore(),
      complianceScore: biasedScore(),
      attentionScore: biasedScore(),
      trustScore: biasedScore(),
    };
    const avg =
      (scores.qualityScore + scores.responseTimeScore + scores.complianceScore + scores.attentionScore + scores.trustScore) /
      5;

    const sellerCreatedAt = addDays(order.deliveredAt ?? order.createdAt, randInt(0, 10));
    const clampedSellerCreatedAt = sellerCreatedAt.getTime() > now.getTime() ? now : sellerCreatedAt;
    const sellerModerationStatus = moderationPool();
    const sellerComment = reviewComment(avg, {
      positive: SELLER_POSITIVE_COMMENTS,
      neutral: SELLER_NEUTRAL_COMMENTS,
      negative: SELLER_NEGATIVE_COMMENTS,
    });

    const productCreatedAt = addDays(order.deliveredAt ?? order.createdAt, randInt(0, 10));
    const clampedProductCreatedAt = productCreatedAt.getTime() > now.getTime() ? now : productCreatedAt;
    const productModerationStatus = moderationPool();
    const productComment = reviewComment(scores.qualityScore, {
      positive: PRODUCT_POSITIVE_COMMENTS,
      neutral: PRODUCT_NEUTRAL_COMMENTS,
      negative: PRODUCT_NEGATIVE_COMMENTS,
    });

    sellerReviewRows.push({
      id: uuid(),
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      ...scores,
      comment: sellerComment,
      moderationStatus: sellerModerationStatus,
      createdAt: clampedSellerCreatedAt,
    });
    productReviewRows.push({
      id: uuid(),
      orderId: order.id,
      orderItemId: order.firstOrderItemId,
      productId: order.firstProductId,
      buyerId: order.buyerId,
      rating: scores.qualityScore,
      comment: productComment,
      moderationStatus: productModerationStatus,
      createdAt: clampedProductCreatedAt,
    });
  });

  await batchCreate('seller_reviews', sellerReviewRows, (c) => prisma.sellerReview.createMany({ data: c }));
  await batchCreate('product_reviews', productReviewRows, (c) => prisma.productReview.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 15. REPORTES
  // ------------------------------------------------------------------------
  console.log('\n\u{1F6A9} Reportes...');

  const reportStatusPool = weightedPickPool([
    { value: ReportStatus.RESOLVED, weight: 60 },
    { value: ReportStatus.REVIEWED, weight: 15 },
    { value: ReportStatus.PENDING, weight: 15 },
    { value: ReportStatus.DISMISSED, weight: 10 },
  ]);
  const targetTypePool = weightedPickPool([
    { value: ReportTargetType.PRODUCT, weight: 50 },
    { value: ReportTargetType.SELLER, weight: 35 },
    { value: ReportTargetType.REVIEW, weight: 15 },
  ]);

  const reportRows: {
    id: string;
    reporterId: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    status: ReportStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    resolvedBy: string | null;
  }[] = [];

  const approvedReviewIds = [...productReviewRows.map((r) => r.id), ...sellerReviewRows.map((r) => r.id)];
  for (let i = 0; i < 400; i++) {
    const targetType = targetTypePool();
    let targetId: string;
    if (targetType === ReportTargetType.PRODUCT) targetId = pick(activeProducts).id;
    else if (targetType === ReportTargetType.SELLER) targetId = pick(sellerRefs).id;
    else {
      if (approvedReviewIds.length === 0) continue;
      targetId = pick(approvedReviewIds);
    }
    const reporter = pick([...buyerUserRefs, ...sellerUserRefs]);
    const createdAt = growthDate(MONTHS_OF_HISTORY, now);
    const status = reportStatusPool();
    const resolvedAt = status === ReportStatus.PENDING ? null : addDays(createdAt, randInt(1, 15));
    reportRows.push({
      id: uuid(),
      reporterId: reporter.id,
      targetType,
      targetId,
      reason: pick(REPORT_REASONS),
      status,
      createdAt,
      resolvedAt: resolvedAt && resolvedAt.getTime() > now.getTime() ? now : resolvedAt,
      resolvedBy: resolvedAt ? pick(adminIds) : null,
    });
  }

  await batchCreate('reports', reportRows, (c) => prisma.report.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // 16. NOTIFICACIONES
  // ------------------------------------------------------------------------
  console.log('\n\u{1F514} Notificaciones...');

  const sellerUserIdByProfile = new Map(sellerRefs.map((s) => [s.id, s.userId]));
  const notificationRows: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }[] = [];

  function pushNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    createdAt: Date,
  ) {
    notificationRows.push({
      id: uuid(),
      userId,
      type,
      title,
      message,
      isRead: Math.random() < 0.6,
      createdAt: createdAt.getTime() > now.getTime() ? now : createdAt,
    });
  }

  faker.helpers.arrayElements(orderRefs, Math.round(orderRefs.length * 0.5)).forEach((o) => {
    const sellerUserId = sellerUserIdByProfile.get(o.sellerId);
    if (!sellerUserId) return;
    pushNotification(
      sellerUserId,
      NotificationType.NEW_ORDER,
      'Nueva solicitud de compra',
      'Has recibido una nueva solicitud de compra en tu tienda.',
      o.createdAt,
    );
  });
  faker.helpers.arrayElements(confirmedOrLaterOrders, Math.round(confirmedOrLaterOrders.length * 0.3)).forEach((o) => {
    pushNotification(
      o.buyerId,
      NotificationType.ORDER_ACCEPTED,
      'Pedido aceptado',
      'El vendedor aceptó tu solicitud de compra.',
      addHours(o.createdAt, randInt(2, 30)),
    );
  });
  faker.helpers.arrayElements(cancelledOrders, Math.round(cancelledOrders.length * 0.6)).forEach((o) => {
    pushNotification(
      o.buyerId,
      NotificationType.ORDER_CANCELLED,
      'Pedido cancelado',
      'Tu solicitud de compra fue cancelada.',
      addHours(o.createdAt, randInt(2, 40)),
    );
  });
  sellerProfileRows.forEach((sp) => {
    if (sp.verificationStatus === VerificationStatus.VERIFIED) {
      const userId = sellerRefs.find((s) => s.id === sp.id)?.userId;
      if (userId) {
        pushNotification(
          userId,
          NotificationType.SELLER_APPROVED,
          'Cuenta de vendedor aprobada',
          'Tu perfil de vendedor ha sido verificado. Ya puedes publicar productos.',
          sp.verifiedAt ?? sp.createdAt,
        );
      }
    } else if (sp.verificationStatus === VerificationStatus.REJECTED) {
      const userId = sellerRefs.find((s) => s.id === sp.id)?.userId;
      if (userId) {
        pushNotification(
          userId,
          NotificationType.SELLER_REJECTED,
          'Verificación rechazada',
          'Tu documentación no pudo ser validada. Por favor revisa tus datos.',
          sp.updatedAt,
        );
      }
    }
  });
  faker.helpers.arrayElements(sellerReviewRows, Math.round(sellerReviewRows.length * 0.4)).forEach((r) => {
    const sellerUserId = sellerUserIdByProfile.get(r.sellerId);
    if (!sellerUserId) return;
    pushNotification(
      sellerUserId,
      NotificationType.NEW_REVIEW,
      'Nueva reseña recibida',
      'Un comprador ha dejado una reseña sobre tu producto.',
      r.createdAt,
    );
  });
  reportRows.forEach((r) => {
    pushNotification(
      pick(adminIds),
      NotificationType.REPORT_RECEIVED,
      'Nuevo reporte recibido',
      `Se ha recibido un reporte: ${r.reason}.`,
      r.createdAt,
    );
  });

  await batchCreate('notifications', notificationRows, (c) =>
    prisma.notification.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 17. TRANSACCIONES (preparación futura de pagos — MVP no las usa aún)
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4B8} Transacciones (muestra de preparación futura)...');

  const activePaymentMethods = paymentMethods.filter((pm) => pm.isActive);
  const transactionOrders = faker.helpers.arrayElements(
    deliveredOrders,
    Math.min(TARGET_COUNTS.transactions, deliveredOrders.length),
  );
  const txStatusPool = weightedPickPool([
    { value: TransactionStatus.COMPLETED, weight: 85 },
    { value: TransactionStatus.PENDING, weight: 5 },
    { value: TransactionStatus.FAILED, weight: 5 },
    { value: TransactionStatus.REFUNDED, weight: 5 },
  ]);

  const orderAmountById = new Map(orderRows.map((o) => [o.id, o.totalAmount]));
  const transactionRows = transactionOrders.map((o) => {
    const amount = orderAmountById.get(o.id) ?? 0;
    const commissionAmount = Number(((amount * currentCommissionPct) / 100).toFixed(2));
    const status = txStatusPool();
    const createdAt = addHours(o.deliveredAt ?? o.createdAt, randInt(1, 12));
    return {
      id: uuid(),
      orderId: o.id,
      paymentMethodId: pick(activePaymentMethods).id,
      amount,
      commissionAmount,
      commissionPercentage: currentCommissionPct,
      status,
      externalReference: `TXN-${faker.string.alphanumeric(10).toUpperCase()}`,
      createdAt: createdAt.getTime() > now.getTime() ? now : createdAt,
      completedAt:
        status === TransactionStatus.COMPLETED || status === TransactionStatus.REFUNDED
          ? addHours(createdAt, randInt(1, 6))
          : null,
    };
  });

  await batchCreate('transactions', transactionRows, (c) =>
    prisma.transaction.createMany({ data: c }),
  );

  // ------------------------------------------------------------------------
  // 18. AUDITORÍA
  // ------------------------------------------------------------------------
  console.log('\n\u{1F4CB} Auditoría...');

  const auditRows: {
    id: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValue: any;
    newValue: any;
    createdAt: Date;
  }[] = [];

  sellerProfileRows
    .filter((sp) => sp.verificationStatus !== VerificationStatus.PENDING)
    .forEach((sp) => {
      auditRows.push({
        id: uuid(),
        userId: sp.verifiedBy,
        action: 'SELLER_VERIFICATION_UPDATED',
        entityType: 'SellerProfile',
        entityId: sp.id,
        oldValue: { verificationStatus: 'PENDING' },
        newValue: { verificationStatus: sp.verificationStatus },
        createdAt: sp.updatedAt,
      });
    });

  reportRows
    .filter((r) => r.status !== ReportStatus.PENDING)
    .forEach((r) => {
      auditRows.push({
        id: uuid(),
        userId: r.resolvedBy,
        action: 'REPORT_RESOLVED',
        entityType: 'Report',
        entityId: r.id,
        oldValue: { status: 'PENDING' },
        newValue: { status: r.status },
        createdAt: r.resolvedAt ?? r.createdAt,
      });
    });

  commissionRows.forEach((cc, idx) => {
    if (idx === 0) return;
    auditRows.push({
      id: uuid(),
      userId: cc.createdBy,
      action: 'COMMISSION_CONFIG_UPDATED',
      entityType: 'CommissionConfig',
      entityId: cc.id,
      oldValue: { percentage: commissionRows[idx - 1].percentage },
      newValue: { percentage: cc.percentage },
      createdAt: cc.effectiveFrom,
    });
  });

  faker.helpers
    .arrayElements(productRows.filter((p) => p.status !== ProductStatus.ACTIVE), 200)
    .forEach((p) => {
      auditRows.push({
        id: uuid(),
        userId: null,
        action: 'PRODUCT_STATUS_CHANGED',
        entityType: 'Product',
        entityId: p.id,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: p.status },
        createdAt: p.updatedAt,
      });
    });

  faker.helpers.arrayElements(orderRefs, Math.round(orderRefs.length * 0.3)).forEach((o) => {
    auditRows.push({
      id: uuid(),
      userId: null,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: o.id,
      oldValue: null,
      newValue: { status: 'PENDING' },
      createdAt: o.createdAt,
    });
  });
  faker.helpers.arrayElements(confirmedOrLaterOrders, Math.round(confirmedOrLaterOrders.length * 0.2)).forEach((o) => {
    auditRows.push({
      id: uuid(),
      userId: null,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'Order',
      entityId: o.id,
      oldValue: { status: 'PENDING' },
      newValue: { status: o.status },
      createdAt: o.deliveredAt ?? o.createdAt,
    });
  });

  await batchCreate('audit_logs', auditRows, (c) => prisma.auditLog.createMany({ data: c }));

  // ------------------------------------------------------------------------
  // REPORTE FINAL DE INTEGRIDAD
  // ------------------------------------------------------------------------
  console.log('\n✅ Seed completado. Generando reporte de integridad...\n');

  // Secuencial (no Promise.all): el pooler de Supabase en modo sesión limita
  // las conexiones concurrentes (pool_size), y 21 counts en paralelo lo excede.
  const counters: [string, () => Promise<number>][] = [
    ['departments', () => prisma.department.count()],
    ['municipalities', () => prisma.municipality.count()],
    ['users', () => prisma.user.count()],
    ['locations', () => prisma.location.count()],
    ['seller_profiles', () => prisma.sellerProfile.count()],
    ['identity_verifications', () => prisma.identityVerification.count()],
    ['categories', () => prisma.category.count()],
    ['products', () => prisma.product.count()],
    ['product_images', () => prisma.productImage.count()],
    ['carts', () => prisma.cart.count()],
    ['cart_items', () => prisma.cartItem.count()],
    ['favorites', () => prisma.favorite.count()],
    ['orders', () => prisma.order.count()],
    ['order_items', () => prisma.orderItem.count()],
    ['product_reviews', () => prisma.productReview.count()],
    ['seller_reviews', () => prisma.sellerReview.count()],
    ['reports', () => prisma.report.count()],
    ['notifications', () => prisma.notification.count()],
    ['payment_methods', () => prisma.paymentMethod.count()],
    ['transactions', () => prisma.transaction.count()],
    ['commission_configs', () => prisma.commissionConfig.count()],
    ['audit_logs', () => prisma.auditLog.count()],
  ];

  let total = 0;
  for (const [label, run] of counters) {
    const count = await run();
    console.log(`  ${label.padEnd(24)} ${String(count).padStart(8)}`);
    total += count;
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${String(total).padStart(8)}`);
  console.log(`\n\u{1F511} Contraseña de todos los usuarios sembrados: ${SEED_PASSWORD}`);
}

/** Convierte una lista de {value, weight} en una función de muestreo reutilizable. */
function weightedPickPool<T>(items: { value: T; weight: number }[]): () => T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  return () => {
    let r = Math.random() * total;
    for (const it of items) {
      if (r < it.weight) return it.value;
      r -= it.weight;
    }
    return items[items.length - 1].value;
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
