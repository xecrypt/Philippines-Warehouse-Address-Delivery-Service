import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * UpdateDeliveryAddressDto
 *
 * Validation for updating user's delivery address.
 * All fields required except zipCode (some areas may not have one).
 */
export class UpdateDeliveryAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  deliveryStreet: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  deliveryCity: string;

  @IsString()
  @IsNotEmpty({ message: 'Province is required' })
  deliveryProvince: string;

  @IsString()
  @IsOptional()
  deliveryZipCode?: string;
}
