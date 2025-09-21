import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../src/models/user'
import { DB_ADDRESS } from '../src/config'

async function run() {
  await mongoose.connect(DB_ADDRESS)
  await User.deleteMany({})
  await User.create([
    { email: 'admin@mail.ru', password: 'password', name: 'Admin', roles: ['admin'] },
    { email: 'user1@mail.ru', password: 'password1', name: 'User1', roles: ['customer'] },
  ])
  await mongoose.disconnect()
  process.exit(0)
}
run()
