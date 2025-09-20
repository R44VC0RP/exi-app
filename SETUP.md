# Setup Instructions

## Required Environment Variables

Add these variables to your `.env.local` file:

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here  # Generate using: openssl rand -base64 32
BETTER_AUTH_URL=https://development.exon.dev  # Your ngrok domain

# Database Configuration (Neon Postgres)
DATABASE_URL=postgresql://username:password@hostname/database

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Development Configuration
NODE_ENV=development
```

## Setup Steps

1. **Create a Neon Database**:
   - Go to [Neon Console](https://console.neon.tech/)
   - Create a new project
   - Copy the connection string to `DATABASE_URL`

2. **Set up GitHub OAuth**:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Create a new OAuth App with:
     - Homepage URL: `https://development.exon.dev`
     - Authorization callback URL: `https://development.exon.dev/api/auth/callback/github`
   - Copy Client ID and Client Secret to your environment variables

3. **Generate Auth Secret**:
   ```bash
   openssl rand -base64 32
   ```
   Add the result to `BETTER_AUTH_SECRET`

4. **Run Database Migrations**:
   ```bash
   # Generate migrations (already done)
   bun run db:generate
   
   # Apply migrations to your database
   bun run db:migrate
   
   # Or push schema directly (for development)
   bun run db:push
   ```

## Development

Start the development server:
```bash
bun run dev:ngrok
```

This will start both Next.js and ngrok tunnel to your configured domain.

## Project Structure

```
lib/
├── auth.ts              # Better Auth configuration
├── auth-client.ts       # Client-side auth utilities
├── auth-server.ts       # Server-side auth utilities
├── auth-schema.ts       # Database schema for auth tables
├── db.ts               # Database connection
├── schema.ts           # Schema exports and types
└── queries/
    └── users.ts        # User database queries

app/
└── api/
    └── auth/
        └── [...all]/
            └── route.ts # Auth API routes

components/
└── auth-button.tsx     # Authentication component
```

## Features

✅ **Better Auth** with GitHub OAuth  
✅ **Drizzle ORM** with Neon Postgres  
✅ **TypeScript** support throughout  
✅ **Database migrations** with Drizzle Kit  
✅ **Session management**  
✅ **User management queries**  
✅ **Responsive auth component**  

## Next Steps

1. Configure your environment variables
2. Set up your Neon database
3. Configure GitHub OAuth
4. Run database migrations
5. Test authentication flow

The authentication system is now ready to use! Check the home page to see the auth button in action.
