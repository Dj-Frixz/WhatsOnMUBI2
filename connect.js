// connect.js
import postgres from 'postgres'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL;

// establish a client
const sql = postgres(connectionString, {
  // you can tune pool size, ssl, etc. here
  ssl: { rejectUnauthorized: false },
})

export default sql