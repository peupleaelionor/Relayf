import {
  IsString,
  IsOptional,
  IsArray,
  IsDate,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) scopes?: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) rateLimitRpm?: number;
}
