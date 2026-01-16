import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for confirming payment on a delivery.
 *
 * Staff confirms that payment has been received.
 */
export class ConfirmPaymentDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
