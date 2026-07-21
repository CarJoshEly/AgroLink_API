import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_SIZE,
} from '../common/constants';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url');
    const key = this.configService.get<string>('supabase.key');
    this.bucket = this.configService.get<string>('supabase.bucket') ?? 'data';
    this.client = createClient(url ?? '', key ?? '');
  }

  validateImage(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Formatos aceptados: ${ALLOWED_IMAGE_MIMES.join(', ')}`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido (${MAX_IMAGE_SIZE / (1024 * 1024)}MB)`,
      );
    }
  }

  async uploadImage(file: Express.Multer.File, pathPrefix: string): Promise<string> {
    this.validateImage(file);

    const ext = extname(file.originalname) || '.jpg';
    const path = `${pathPrefix}/${randomUUID()}${ext}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      throw new BadRequestException(`Error al subir el archivo: ${error.message}`);
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /** Best-effort: no lanza error si falla (un archivo huérfano no amerita fallar la petición). */
  async deleteImage(publicUrl?: string | null): Promise<void> {
    if (!publicUrl) return;
    try {
      const marker = `/object/public/${this.bucket}/`;
      const idx = publicUrl.indexOf(marker);
      if (idx === -1) return;
      const path = publicUrl.slice(idx + marker.length);
      await this.client.storage.from(this.bucket).remove([path]);
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el archivo anterior: ${(error as Error).message}`);
    }
  }
}
