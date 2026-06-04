import { Request, Response, NextFunction } from 'express'

export function requireManager(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role !== 'manager' && role !== 'superadmin') {
    res.status(403).json({ error: 'Manager access required' })
    return
  }
  next()
}
