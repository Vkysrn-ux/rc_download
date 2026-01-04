import crypto from "crypto"
import type mysql from "mysql2/promise"
import { dbTransaction } from "@/lib/server/db"

export class WalletError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function queryRows<T>(conn: mysql.PoolConnection, sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await conn.query(sql, params)
  return rows as T[]
}

async function exec(conn: mysql.PoolConnection, sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await conn.query(sql, params)
  return result as mysql.ResultSetHeader
}

export async function chargeWalletForDownload(args: {
  userId: string
  registrationNumber: string
  price: number
  description?: string
}): Promise<{ transactionId: string; walletBalance: number }> {
  const price = Number(args.price)
  if (!Number.isFinite(price) || price <= 0) throw new WalletError(500, "Invalid price configuration")

  const registrationNumber = (args.registrationNumber || "").toUpperCase().replace(/\s/g, "")
  if (!registrationNumber) throw new WalletError(400, "Invalid registration number")

  const description = (args.description || `Vehicle RC Download - ${registrationNumber}`).slice(0, 255)

  return dbTransaction(async (conn) => {
    const balances = await queryRows<{ wallet_balance: string | number }>(
      conn,
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
      [args.userId],
    )
    const walletBalance = Number(balances[0]?.wallet_balance ?? 0)
    if (walletBalance < price) throw new WalletError(402, "Insufficient wallet balance")

    const update = await exec(conn, "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [price, args.userId])
    if (update.affectedRows !== 1) throw new WalletError(500, "Failed to charge wallet")

    const txnId = crypto.randomUUID()
    await exec(
      conn,
      "INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, registration_number) VALUES (?, ?, 'download', ?, 'completed', 'wallet', ?, ?)",
      [txnId, args.userId, -price, description, registrationNumber],
    )

    const updated = await queryRows<{ wallet_balance: string | number }>(
      conn,
      "SELECT wallet_balance FROM users WHERE id = ? LIMIT 1",
      [args.userId],
    )
    return { transactionId: txnId, walletBalance: Number(updated[0]?.wallet_balance ?? walletBalance - price) }
  })
}

