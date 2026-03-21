import { IsString, IsEnum, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspacePlan, BillingInterval } from '@prisma/client';

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: WorkspacePlan }) @IsEnum(WorkspacePlan) plan: WorkspacePlan;
  @ApiProperty({ enum: BillingInterval }) @IsEnum(BillingInterval) interval: BillingInterval;
  @ApiProperty() @IsUrl() successUrl: string;
  @ApiProperty() @IsUrl() cancelUrl: string;
}

export class CreatePortalSessionDto {
  @ApiProperty() @IsUrl() returnUrl: string;
}
