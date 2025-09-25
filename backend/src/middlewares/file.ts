import multer from 'multer'

const storage = multer.memoryStorage()

const file = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

export default file
