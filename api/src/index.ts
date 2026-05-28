import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'

import { authenticate } from './middleware/auth'

import authRouter from './routes/auth'
import playersRouter from './routes/players'
import seasonsRouter from './routes/seasons'
import gamesRouter from './routes/games'
import setsRouter from './routes/sets'
import ralliesRouter from './routes/rallies'
import substitutionsRouter from './routes/substitutions'
import timeoutsRouter from './routes/timeouts'
import trainingsRouter from './routes/trainings'
import attendanceRouter from './routes/attendance'
import statsRouter from './routes/stats'
import teamRouter from './routes/team'

const app = express()
const PORT = process.env.PORT || 3005

// CORS — allow the Vite dev server and production web container
app.use(cors({
  origin: [
    'http://localhost:3004',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}))

app.use(express.json())
app.use(cookieParser())

// Serve player photo uploads as public static files
// (no auth required — URLs are non-guessable UUIDs used as filenames)
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads'
app.use('/uploads', express.static(path.resolve(UPLOADS_DIR)))

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Public routes
app.use('/api/auth', authRouter)

// All routes below require authentication
app.use('/api', authenticate)

app.use('/api/players', playersRouter)
app.use('/api/seasons', seasonsRouter)
app.use('/api/games', gamesRouter)
app.use('/api/games/:gameId/sets', setsRouter)
app.use('/api/sets/:setId/rallies', ralliesRouter)
app.use('/api/sets/:setId/substitutions', substitutionsRouter)
app.use('/api/sets/:setId/timeouts', timeoutsRouter)
app.use('/api/trainings', trainingsRouter)
app.use('/api/trainings/:id/attendance', attendanceRouter)
app.use('/api', statsRouter)
app.use('/api/team', teamRouter)

app.listen(PORT, () => {
  console.log(`VB Scout API running on port ${PORT}`)
})

export default app
