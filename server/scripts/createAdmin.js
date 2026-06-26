const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.error('Usage: node scripts/createAdmin.js <username> <password>');
    process.exit(1);
}

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const exists = await Admin.findOne({ username });
        if (exists) {
            console.error(`Error: Admin with username "${username}" already exists.`);
            process.exit(1);
        }

        const admin = new Admin({ username, password });
        await admin.save();
        console.log(`Successfully created admin! Username: ${username}`);
        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
    }
};

createAdmin();
