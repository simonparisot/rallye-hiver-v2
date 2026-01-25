import { getUserById } from './dynamodb';

/**
 * Check if a user has admin privileges
 * @param userId The user ID to check
 * @returns true if user is admin, false otherwise
 * @throws Error if user not found
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return user.isAdmin === true;
}

/**
 * Middleware-style function to require admin access
 * Throws an error if user is not an admin
 * @param userId The user ID to check
 * @throws Error if user is not admin or not found
 */
export async function requireAdmin(userId: string): Promise<void> {
  const isAdmin = await isUserAdmin(userId);

  if (!isAdmin) {
    throw new Error('Admin access required');
  }
}

/**
 * Get admin user details
 * @param userId The user ID to check
 * @returns User object if admin, null otherwise
 */
export async function getAdminUser(userId: string) {
  const user = await getUserById(userId);

  if (!user || !user.isAdmin) {
    return null;
  }

  return user;
}
