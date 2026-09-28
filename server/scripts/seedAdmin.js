const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const adminExists = await Admin.findOne({ username: 'admin' });
        if (adminExists) {
            console.log('Admin already exists');
            process.exit(0);
        }

        const admin = new Admin({
            username: 'admin',
            password: 'password123' // Default password, should be changed later
        });

        await admin.save();
        console.log('Admin user created successfully: username: admin, password: password123');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err);
        process.exit(1);
    }
};

seedAdmin();
