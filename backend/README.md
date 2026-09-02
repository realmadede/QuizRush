# QuizSpark Backend

A Node.js + Express + TypeScript backend for the QuizRush real time quiz application.

## Stack

- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Real-time**: Socket.IO
- **Validation**: Zod

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up database**:

   ```bash
   npm run prisma:migrate
   ```

4. **Generate Prisma client**:

   ```bash
   npm run prisma:generate
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:5000`.

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## API Endpoints

### Authentication

- `POST /api/auth/sign-up` - Register new teacher
- `POST /api/auth/sign-in` - Login teacher
- `GET /api/auth/me` - Get current user (requires auth)

### Quizzes

- `GET /api/quizzes` - List all quizzes (requires auth)
- `GET /api/quizzes/:quizId` - Get quiz details (requires auth)
- `POST /api/quizzes` - Create new quiz (requires auth)
- `PATCH /api/quizzes/:quizId` - Update quiz (requires auth)
- `DELETE /api/quizzes/:quizId` - Delete quiz (requires auth)

### Game Sessions

- `POST /api/sessions` - Create game session (requires auth)
- `POST /api/sessions/join` - Join game session as player
- `GET /api/sessions/:sessionId` - Get session details
- `POST /api/sessions/:sessionId/host-action` - Host controls game flow (requires auth)

### Players

- `POST /api/players/state` - Get player game state
- `POST /api/players/answer` - Submit player answer
- `POST /api/players/rename` - Rename player in lobby

## Socket.IO Events

### Client → Server

- `join_session` - Player joins session

  ```typescript
  { sessionId: string, playerId: string, token: string }
  ```

- `join_host` - Host joins to control session

  ```typescript
  { sessionId: string, userId: string }
  ```

- `join_spectator` - Spectator/projector joins session
  ```typescript
  {
    sessionId: string;
  }
  ```

### Server → Client

- `player_joined` - Emitted when new player joins

  ```typescript
  { playerId: string, nickname: string }
  ```

- `player_disconnected` - Emitted when player disconnects

  ```typescript
  {
    playerId: string;
  }
  ```

- `player_renamed` - Emitted when player renames themselves

  ```typescript
  { playerId: string, nickname: string }
  ```

- `answer_submitted` - Emitted when player submits answer

  ```typescript
  { playerId: string, isCorrect: boolean }
  ```

- `session_updated` - Emitted when session state changes
  ```typescript
  { status: SessionStatus, currentQuestionIndex: number }
  ```

## Authentication

All authenticated endpoints require an `Authorization` header with a JWT token:

```
Authorization: Bearer <jwt_token>
```

Tokens are obtained from the `/api/auth/sign-in` or `/api/auth/sign-up` endpoints.

## Database Schema

See `prisma/schema.prisma` for the complete schema. Key tables:

- `profiles` - Teacher accounts
- `user_roles` - Role assignments
- `quizzes` - Quiz metadata
- `questions` - Quiz questions
- `answers` - Answer options
- `game_sessions` - Active game sessions
- `players` - Players in a session
- `player_answers` - Player responses
- `game_results` - Final results per session

## Environment Variables

```
DATABASE_URL         - PostgreSQL connection string
PORT                 - Server port (default: 5000)
NODE_ENV             - Environment (development/production)
JWT_SECRET           - Secret for signing JWT tokens
JWT_EXPIRY           - Token expiration time (default: 7d)
FRONTEND_URL         - Frontend origin for CORS
```

## Development Tips

### Using Prisma Studio

Open an interactive GUI for your database:

```bash
npm run prisma:studio
```

### Viewing Database Migrations

Migrations are stored in `prisma/migrations/`. To create a new migration:

```bash
npm run prisma:migrate
```

### Adding New Routes

1. Create a new file in `src/routes/`
2. Define routes using Express Router
3. Import and mount in `src/index.ts`

Example:

```typescript
// src/routes/example.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  // Handle request
  res.json({ ok: true });
});

export default router;
```

Then in `src/index.ts`:

```typescript
import exampleRoutes from './routes/example';
app.use('/api/example', exampleRoutes);
```

## Deployment

### Build

```bash
npm run build
```

This creates a `dist/` folder with compiled JavaScript.

### Run Production Build

```bash
npm start
```

Make sure to:

1. Set `NODE_ENV=production`
2. Use a proper database with backups
3. Set a strong `JWT_SECRET`
4. Update `FRONTEND_URL` to your production domain

## License

MIT
