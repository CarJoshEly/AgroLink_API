import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

// DTO independiente (no extiende RegisterBuyerDto): a diferencia del
// comprador, el teléfono es obligatorio para vendedores, y mezclar
// decoradores @IsOptional (padre) / @IsNotEmpty (hijo) sobre la misma
// propiedad vía herencia es ambiguo en class-validator.
export class RegisterSellerDto {
  @ApiProperty({ example: 'María Fernández' })
  @SanitizeHtml()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @ApiProperty({ example: '99887766' })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio para vendedores' })
  phone: string;

  @ApiProperty({ example: 'Segura123' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password: string;

  @ApiProperty({ example: 'Finca Fernández' })
  @SanitizeHtml()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  businessName: string;

  @ApiProperty({ example: '0801-1995-04521', description: 'DNI hondureño' })
  @IsString()
  @Matches(/^\d{4}-\d{4}-\d{5}$/, {
    message: 'El DNI debe tener el formato XXXX-XXXX-XXXXX',
  })
  dni: string;

  @ApiProperty({ description: 'ID del departamento (catálogo geográfico)' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ description: 'ID del municipio (catálogo geográfico)' })
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ example: 'Barrio El Centro, 2da calle' })
  @SanitizeHtml()
  @IsString()
  @MinLength(5)
  address: string;

  @ApiProperty({ example: 14.0723 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -87.1921 })
  @IsLongitude()
  longitude: number;

  @ApiProperty({ description: 'URL (Supabase Storage) de la foto frontal del DNI', required: false })
  @IsOptional()
  @IsUrl()
  dniFrontUrl?: string;

  @ApiProperty({ description: 'URL (Supabase Storage) de la foto posterior del DNI', required: false })
  @IsOptional()
  @IsUrl()
  dniBackUrl?: string;

  @ApiProperty({ description: 'URL (Supabase Storage) de la selfie', required: false })
  @IsOptional()
  @IsUrl()
  selfieUrl?: string;

  @ApiProperty({ description: 'URL (Supabase Storage) de la prueba de vida', required: false })
  @IsOptional()
  @IsUrl()
  lifeProofUrl?: string;
}
