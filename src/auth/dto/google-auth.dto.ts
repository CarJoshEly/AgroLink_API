import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'ID token (JWT) emitido por Google Identity Services / google_sign_in' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
