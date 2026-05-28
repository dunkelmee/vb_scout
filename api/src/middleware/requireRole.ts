import { Request, Response, NextFunction } from 'express'

export function requireManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'manager') {
    res.status(403).json({ error: 'Manager access required' })
    return
  }
  next()
}
