# FairShare Lite

A simplified expense-sharing web application built with modern web technologies.

## Features

- **Simple User Management**: Register and login with username/password
- **Group Expenses**: Create groups and manage shared expenses
- **Split Expenses**: Support for equal splits, custom amounts, and shares
- **Settle Up**: Track balances and settle payments between group members
- **Comments**: Add comments to expenses for context
- **Clean UI**: Desktop-focused interface with Tailwind CSS

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Tailwind CSS
- **Database**: PostgreSQL
- **Deployment**: Ready for Render

## Project Structure

```
fairshare-lite/
├── backend/              # Express API server
│   ├── src/
│   │   ├── index.ts     # Main server entry
│   │   ├── db.ts        # Database connection
│   │   ├── database.ts  # Schema initialization
│   │   ├── middleware/  # Auth middleware
│   │   └── routes/      # API routes
│   ├── package.json
│   └── tsconfig.json
├── frontend/            # React application
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable components
│   │   ├── contexts/    # Auth context
│   │   ├── services/    # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml   # PostgreSQL container
├── .env.example         # Environment variables template
└── package.json         # Root scripts
```

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### 1. Clone & Install Dependencies

```bash
# Install root dependencies (optional for scripts)
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Update `.env` if needed (default values are provided for local development).

### 3. Start PostgreSQL

```bash
npm run db:up
```

This starts a PostgreSQL container with the database `fairshare_lite`.

### 4. Start the Development Servers

**Option A: Run both concurrently**
```bash
npm run dev
```

**Option B: Run separately in different terminals**

Terminal 1 (Backend):
```bash
npm run dev:backend
```

Terminal 2 (Frontend):
```bash
npm run dev:frontend
```

The backend runs on `http://localhost:5000` and frontend on `http://localhost:3000`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Groups
- `GET /api/groups` - Get all user's groups
- `GET /api/groups/:groupId` - Get group details
- `POST /api/groups` - Create new group
- `POST /api/groups/:groupId/members` - Add member to group

### Expenses
- `POST /api/expenses` - Create expense
- `GET /api/expenses/:expenseId` - Get expense details
- `POST /api/expenses/:expenseId/comments` - Add comment to expense

### Settlements
- `GET /api/settlements/balances/:groupId` - Get group balances
- `POST /api/settlements/:groupId/settle` - Record settlement

## Development

### Building

```bash
npm run build
```

This builds both backend and frontend.

### Type Checking

```bash
# Check backend types
npm run build:backend

# Check frontend types
npm run build:frontend
```

### Database Management

```bash
# Stop database
npm run db:down

# Reset database (stop and restart)
npm run db:reset
```

## Deployment to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: A strong secret key
   - `NODE_ENV`: `production`
4. Build command: `npm run build && npm run start:backend`
5. Start command: `npm run start:backend`

For the frontend, create a separate Static Site service pointing to the `frontend/dist` directory.

## Key Features

### User Authentication
- JWT-based authentication
- Secure password hashing with bcryptjs

### Expense Splitting
- **Equal Split**: Divides amount equally among members
- **Unequal Split**: Custom amounts for each member
- **Shares**: Split based on shares (coming soon)

### Balance Tracking
- Automatic calculation of who owes whom
- Settlement history

### Comments
- Add context to expenses with comments
- Track conversation around shared costs

## Contributing

Feel free to extend FairShare Lite with additional features!

## License

MIT
