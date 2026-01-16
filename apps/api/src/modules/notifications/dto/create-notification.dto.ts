import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NotificationType } from '@prisma/client';

/**
 * DTO for creating a notification (internal use by services).
 */
export class CreateNotificationDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsUUID()
  @IsOptional()
  parcelId?: string;

  @IsUUID()
  @IsOptional()
  deliveryId?: string;
}
