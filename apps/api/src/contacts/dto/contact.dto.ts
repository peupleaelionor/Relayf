import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  IsPhoneNumber,
} from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telegramId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() attributes?: Record<string, any>;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ImportContactsDto {
  @ApiPropertyOptional({ description: 'CSV data as string' })
  @IsString()
  csvData: string;
}
