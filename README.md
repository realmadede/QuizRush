
# QuizSpark

An interactive, real time classroom quiz application built to make learning engaging and competitive. 

Teachers can create quizzes, host live game sessions, and broadcast questions in real time. Students join seamlessly using a 6 digit Game PIN on any mobile browser competing for the top spot on the live leaderboard.

## Features

* **Real time Synchronization:** Built with Socket.io, questions and answers instantly push to player devices exactly when the host triggers them.
* **Teacher Dashboard:** Secure authentication to create, edit, and manage an unlimited number of quizzes.
* **Frictionless Joining:** Students do not need accounts. They simply enter a Game PIN and a nickname to start playing immediately.
* **Live Leaderboards & Analytics:** Tracks right/wrong answers and automatically calculates player accuracy and rankings at the end of the game.
* **Mobile-First Design:** Fully responsive player screens that work perfectly on any mobile browser.

## 🛠️ Technology Stack

**Frontend (Client)**
* [React 19](https://react.dev/) & [Vite](https://vitejs.dev/)
* [TanStack Start / Router](https://tanstack.com/) (For robust client-side routing)
* [TailwindCSS 4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) (Styling & Components)
* [TanStack Query](https://tanstack.com/query) (Data fetching & state management)

**Backend (Server)**
* [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) (API routing)
* [Socket.io](https://socket.io/) (WebSockets for real-time multiplayer)
* [PostgreSQL](https://www.postgresql.org/) (Relational database)
* [Prisma ORM](https://www.prisma.io/) (Type-safe database access)
* [JSON Web Tokens (JWT)](https://jwt.io/) (Secure authentication)

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites
Before you begin, ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [PostgreSQL](https://www.postgresql.org/) installed and running locally

### 1. Clone the repository
```bash
git clone https://github.com/realmadede/QuizSpark.git
cd QuizSpark
```

### 2. Install Dependencies
You will need to install dependencies for both the frontend (root) and the backend.
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### 3. Environment Variables
Navigate to the `backend/` directory and create a new file named `.env`. Add the following keys and adjust the database credentials to match your local PostgreSQL setup:

```env
# /backend/.env

# PostgreSQL Database Connection String
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/quizspark?schema=public"

# Authentication Secret (Random cryptographic string)
JWT_SECRET="super_secret_jwt_key_for_local_development"

# Backend API & WebSocket Port
PORT=5000

# Frontend URL (For CORS policies)
CLIENT_URL="http://localhost:8080"
```

### 4. Database Setup
With your `.env` configured and PostgreSQL running, initialize the database schema using Prisma. From inside the `backend/` directory, run:
```bash
npm run prisma:migrate
npm run prisma:generate
```

### 5. Running the Application
You need to start both the backend server and the frontend client simultaneously. Open two separate terminal windows.

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```
*(You should see "Server running on port 5000" and "Connected to Database")*

**Terminal 2 (Frontend):**
```bash
# From the root QuizSpark folder
npm run dev
```
*(The frontend UI will start on `http://localhost:8080`)*

---

## Project Structure
```text
QuizSpark/
├── backend/                  # Express/Node.js Server
│   ├── prisma/               # Database schemas and migrations
│   └── src/                  
│       ├── routes/           # REST API endpoints (quizzes, auth, sessions)
│       ├── socket/           # WebSocket event handlers for live games
│       └── index.ts          # Main backend entry point
├── src/                      # React Frontend
│   ├── components/ui/        # Reusable Shadcn UI components
│   ├── hooks/                # Custom React hooks (useSocket, useAuth)
│   ├── lib/                  # API clients and utility functions
│   ├── routes/               # TanStack router page definitions
│   └── styles.css            # Global Tailwind configurations
└── vite.config.ts            # Vite build configuration
```

## Footer

This project is for educational and training purposes.
