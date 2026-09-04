# QuizSpark

QuizSpark is an interactive, real-time classroom quiz application built to make learning incredibly engaging and highly competitive. 

I built this project because I firmly believe that learning should be fun. Teachers can easily create quizzes, host live game sessions, and broadcast questions to their class in real-time. Students jump right into the action seamlessly using a simple 6-digit Game PIN on any mobile browser, battling it out for the top spot on the live leaderboard.

## Exciting Features

* **Real-time Synchronization:** Built securely with Socket.io, questions and answers instantly push to player devices exactly when the host triggers them.
* **Player Avatars:** Students can express their personality by selecting from a fun set of predefined animal and robot avatars before joining a lobby.
* **Teacher Dashboard:** A comprehensive, secure authentication system allows educators to create, edit, and manage an unlimited number of quizzes.
* **Advanced Session Controls:** Teachers can toggle "Auto-Advance" to let the game run itself, or manually control the pace of every question and leaderboard reveal.
* **Dynamic Quiz Editor:** Supports multiple choice and rapid True/False question templates with customizable timers.
* **Strict Publishing Security:** Quizzes are kept safely in "Draft" mode until the teacher is completely ready to publish and play.
* **Frictionless Joining:** Students do not need accounts. They simply enter a Game PIN, pick an avatar, and start playing immediately.
* **Live Leaderboards & Analytics:** The system tracks right and wrong answers, automatically calculating player accuracy and rankings at the end of the game.
* **Podium & Confetti Finish:** The game ends with an exciting 3-tier visual podium and celebratory confetti animations to reward the top players.
* **Robust Authentication:** Includes full email verification and a secure password reset workflow.
* **Mobile First Design:** Fully responsive player screens that work perfectly on any mobile browser.

## Technology Stack

**Frontend (Client)**

* [React 19](https://react.dev/) & [Vite](https://vitejs.dev/)
* [TanStack Start / Router](https://tanstack.com/) (For robust client-side routing)
* [TailwindCSS 4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) (Styling & Components)
* [TanStack Query](https://tanstack.com/query) (Data fetching & state management)
* [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) (For that extra victory flair)

**Backend (Server)**

* [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) (API routing)
* [Socket.io](https://socket.io/) (WebSockets for real-time multiplayer)
* [PostgreSQL](https://www.postgresql.org/) (Relational database)
* [Prisma ORM](https://www.prisma.io/) (Type-safe database access)
* [JSON Web Tokens (JWT)](https://jwt.io/) (Secure authentication)
* [Nodemailer](https://nodemailer.com/) (For secure email communications)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing. I have tried to make this as straightforward as possible!

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

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
FRONTEND_URL="http://localhost:5173"

# SMTP Settings for Emails (Optional for local testing)
# SMTP_EMAIL="your_email@gmail.com"
# SMTP_PASSWORD="your_app_password"
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

(You should see "Server running on port 5000" and "Connected to Database" in your terminal)

**Terminal 2 (Frontend):**

```bash
# From the root QuizSpark folder
npm run dev
```

(The frontend UI will start on `http://localhost:5173`)

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

## Thank You!

Made by madede. This project was built with a lot of love for educational and training purposes. I hope you enjoy using it as much as I enjoyed building it.
