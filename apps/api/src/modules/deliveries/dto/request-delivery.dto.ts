import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO for requesting delivery of a parcel.
 *
 * User must provide their delivery address if not already on file.
 */
export class RequestDeliveryDto {
  @IsUUID()
  @IsNotEmpty()
  parcelId: string;

  @IsString()
  @IsNotEmpty()
  deliveryStreet: string;

  @IsString()
  @IsNotEmpty()
  deliveryCity: string;

  @IsString()
  @IsNotEmpty()
  deliveryProvince: string;

  @IsString()
  @IsNotEmpty()
  deliveryZipCode: string;
}
