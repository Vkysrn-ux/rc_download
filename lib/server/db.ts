import mysql from "mysql2/promise"

let pool: mysql.Pool | null = null

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getDbPool(): mysql.Pool {
  if (pool) return pool

  const host = required("DB_HOST")
  const user = required("DB_USER")
  const password = required("DB_PASSWORD")
  const database = required("DB_NAME")
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  })

  return pool
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getDbPool().query(sql, params)
  return rows as T[]
}

