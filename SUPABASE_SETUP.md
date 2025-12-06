# Supabase Database Setup Guide

This project uses Supabase as the backend database. Follow these steps to connect your application to Supabase.

## Option 1: Using an Existing Supabase Project

If you already have a Supabase project:

1. **Get your Supabase credentials:**

   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project (or create a new one)
   - Navigate to **Settings** → **API**
   - Copy the following values:
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon public** key (under "Project API keys")

2. **Create environment file:**
   Create a `.env.local` file in the root directory with:

   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
   ```

3. **Run database migrations:**
   The migrations are in `supabase/migrations/`. You can apply them:

   **Using Supabase CLI (recommended):**

   ```bash
   # Install Supabase CLI if you haven't
   npm install -g supabase

   # Link to your project
   supabase link --project-ref your-project-ref

   # Push migrations
   supabase db push
   ```

   **Or manually via Supabase Dashboard:**

   - Go to **SQL Editor** in your Supabase dashboard
   - Copy the contents of `supabase/migrations/20251205104946_97bc54a8-db5d-4f0e-a12f-701452f32444.sql`
   - Paste and run it
   - Then run `supabase/migrations/20251205104954_928297b2-1036-4dfb-85d9-1fc9143c37d6.sql`

## Option 2: Create a New Supabase Project

1. **Sign up/Login:**

   - Go to [supabase.com](https://supabase.com)
   - Sign up or log in

2. **Create a new project:**

   - Click "New Project"
   - Choose an organization
   - Fill in:
     - **Name**: Virtual Lab (or your preferred name)
     - **Database Password**: Choose a strong password (save it!)
     - **Region**: Choose closest to you
   - Click "Create new project"
   - Wait for provisioning (2-3 minutes)

3. **Get your credentials:**

   - Once ready, go to **Settings** → **API**
   - Copy:
     - **Project URL**
     - **anon public** key

4. **Set up environment variables:**
   Create `.env.local` file:

   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Run migrations:**
   Use Supabase CLI or SQL Editor (see Option 1, step 3)

## Option 3: Local Development with Supabase CLI

For local development:

1. **Install Supabase CLI:**

   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase:**

   ```bash
   supabase start
   ```

   This will:

   - Start local Supabase instance
   - Show you local credentials
   - Create a `.env.local` file automatically

3. **Apply migrations:**

   ```bash
   supabase db reset
   ```

4. **Use local credentials:**
   The `.env.local` file will be auto-generated with local values.

## Database Schema

Your database includes these tables:

- `profiles` - User profiles with XP, level, role
- `experiments` - Available experiments
- `experiment_runs` - Student experiment attempts
- `badges` - Achievement badges
- `user_badges` - User badge assignments
- `leaderboard` - View for rankings

## Security & Row Level Security (RLS)

Make sure to enable Row Level Security policies in Supabase:

- Go to **Authentication** → **Policies**
- Set up policies for each table to ensure users can only access their own data

## Testing the Connection

After setting up:

1. **Start the dev server:**

   ```bash
   npm run dev
   ```

2. **Check browser console:**

   - Open DevTools (F12)
   - Look for any Supabase connection errors
   - Should see successful auth initialization

3. **Test authentication:**
   - Go to `/auth` page
   - Try signing up a test user
   - Check Supabase Dashboard → **Authentication** → **Users** to see if user was created

## Troubleshooting

**Blank page or connection errors:**

- Verify `.env.local` file exists and has correct values
- Check that environment variables start with `VITE_`
- Restart dev server after changing `.env.local`

**Database errors:**

- Ensure migrations have been run
- Check Supabase Dashboard → **Database** → **Tables** to verify tables exist
- Verify RLS policies are set up correctly

**Authentication not working:**

- Check Supabase Dashboard → **Authentication** → **Settings**
- Verify email auth is enabled
- Check redirect URLs are configured

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- Check your project's Supabase Dashboard for logs and monitoring
