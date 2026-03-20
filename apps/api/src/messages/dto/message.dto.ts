import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ enum: MessageChannel }) @IsEnum(MessageChannel) channel: MessageChannel;
  @ApiProperty() @IsString() to: string;
  @ApiProperty() @IsString() body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
}
