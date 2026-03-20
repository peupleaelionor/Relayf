import { IsString, IsOptional, MinLength, MaxLength, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateWorkspaceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
}

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
}

export class InviteMemberDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
}
