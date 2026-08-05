import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Usage: @Roles('DIRECTOR', 'ADMIN')
 * Put above a controller method to restrict access to those roles only.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
