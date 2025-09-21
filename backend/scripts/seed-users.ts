import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User, { Role } from '../src/models/user'
import { DB_ADDRESS } from '../src/config'

const run = async () => {
    await mongoose.connect(DB_ADDRESS)

    const adminEmail = 'admin@mail.ru'
    const adminPass = 'password'
    const userEmail = 'u1@test.com'
    const userPass = 'password1'

    const adminHash = await bcrypt.hash(adminPass, 10)
    const userHash = await bcrypt.hash(userPass, 10)

    await User.updateOne(
        { email: adminEmail },
        {
            $setOnInsert: {
                email: adminEmail,
                password: adminHash,
                name: 'Admin',
                roles: [Role.Admin],
            },
        },
        { upsert: true }
    )

    await User.updateOne(
        { email: userEmail },
        {
            $setOnInsert: {
                email: userEmail,
                password: userHash,
                name: 'User One',
                roles: [],
            },
        },
        { upsert: true }
    )

    await mongoose.disconnect()
}
run().catch((e) => {
    console.error(e)
    process.exit(1)
})
