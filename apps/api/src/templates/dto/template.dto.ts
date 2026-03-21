import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MessageChannel, TemplateStatus } from '@prisma/client';

export class CreateTemplateDto {
  @ApiProperty() @IsString() @MinLength(1) name: string;
  @ApiProperty({ enum: MessageChannel }) @IsEnum(MessageChannel) channel: MessageChannel;
  @ApiProperty() @IsString() @MinLength(1) body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) variables?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() previewText?: string;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class PreviewTemplateDto {
  @ApiPropertyOptional() @IsOptional() sampleData?: Record<string, string>;
}
