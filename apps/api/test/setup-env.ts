import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Fallback to main .env if test env doesn't exist
dotenv.config({ path: path.resolve(__dirname, '../.env') });
