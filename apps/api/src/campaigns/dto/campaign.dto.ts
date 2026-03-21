import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDate,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: MessageChannel }) @IsEnum(MessageChannel) channel: MessageChannel;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() scheduledAt?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() senderIdentityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) throttleRpm?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) recipientContactIds?: string[];
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class ScheduleCampaignDto {
  @ApiProperty() @Type(() => Date) @IsDate() scheduledAt: Date;
}
