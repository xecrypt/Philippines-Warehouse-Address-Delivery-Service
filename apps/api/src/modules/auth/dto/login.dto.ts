import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * LoginDto
 *
 * Validation rules for user login.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
