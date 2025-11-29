import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// ✅ VITE_SUPABASE_URL is OK to use - URL is public, access is controlled by keys
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// ✅ SUPABASE_SERVICE_ROLE_KEY is correct (NO VITE_ prefix) - this is a secret!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DeleteUserRequest {
  userId: string;
  requestingUserId: string;
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId, requestingUserId }: DeleteUserRequest = JSON.parse(
      event.body || '{}'
    );

    // Validate required fields
    if (!userId || !requestingUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Verify the requesting user is an admin
    const { data: requestingUser, error: userError } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', requestingUserId)
      .single();

    if (userError || requestingUser?.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized: Only admins can delete users' }),
      };
    }

    // Prevent self-deletion
    if (userId === requestingUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cannot delete your own account' }),
      };
    }

    // Get user info before deletion
    const { data: userToDelete } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Delete from Supabase Auth (this will cascade to user_profiles)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      throw authError;
    }

    console.log('User deleted:', {
      deletedUserId: userId,
      deletedUserName: userToDelete?.full_name,
      deletedUserEmail: userToDelete?.email,
      deletedBy: requestingUser.full_name,
      deletedAt: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `User ${userToDelete?.full_name || userToDelete?.email} has been deleted successfully`,
      }),
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
