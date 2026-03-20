import { IsString, IsUrl, IsArray, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WebhookEventType } from '@prisma/client';

export class CreateWebhookDto {
  @ApiProperty() @IsUrl() url: string;
  @ApiProperty({ enum: WebhookEventType, isArray: true })
  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {}
