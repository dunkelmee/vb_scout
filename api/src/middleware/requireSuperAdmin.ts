import { Request, Response, NextFunction } from 'express'

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
