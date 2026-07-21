import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { calculateDistance } from '../common/utils';
import { CalculateDistanceDto, NearbySellersQueryDto } from './dto';

type NearbySellerRow = {
  sellerId: string;
  businessName: string;
  ownerName: string;
  departmentName: string;
  municipalityName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  listMunicipalities(departmentId?: string) {
    return this.prisma.municipality.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  calculateDistanceKm(dto: CalculateDistanceDto): { distanceKm: number } {
    const distanceKm = calculateDistance(
      dto.originLatitude,
      dto.originLongitude,
      dto.destinationLatitude,
      dto.destinationLongitude,
    );
    return { distanceKm };
  }

  async findNearbySellers(query: NearbySellersQueryDto) {
    const { latitude, longitude } = query;
    const radiusKm = query.radiusKm ?? 25;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // Haversine calculado en SQL — evita traer todos los vendedores a Node
    // solo para filtrar/ordenar por distancia.
    const base = Prisma.sql`
      SELECT
        sp.id AS "sellerId",
        sp."businessName",
        u.name AS "ownerName",
        d.name AS "departmentName",
        m.name AS "municipalityName",
        l.latitude::float8 AS latitude,
        l.longitude::float8 AS longitude,
        (6371 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(${latitude})) * cos(radians(l.latitude::float8)) * cos(radians(l.longitude::float8) - radians(${longitude}))
          + sin(radians(${latitude})) * sin(radians(l.latitude::float8))
        )))) AS "distanceKm"
      FROM seller_profiles sp
      JOIN users u ON u.id = sp."userId"
      JOIN locations l ON l."userId" = sp."userId" AND l."isPrimary" = true
      JOIN departments d ON d.id = l."departmentId"
      JOIN municipalities m ON m.id = l."municipalityId"
      WHERE sp."verificationStatus" = 'VERIFIED'
        AND sp."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
    `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<NearbySellerRow[]>(
        Prisma.sql`SELECT * FROM (${base}) sub WHERE "distanceKm" <= ${radiusKm} ORDER BY "distanceKm" ASC LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM (${base}) sub WHERE "distanceKm" <= ${radiusKm}`,
      ),
    ]);

    return {
      data: rows.map((r) => ({ ...r, distanceKm: Number(r.distanceKm.toFixed(2)) })),
      total: Number(countRows[0]?.count ?? 0),
      page,
      limit,
    };
  }
}
