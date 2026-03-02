import mongoose from "mongoose";
import { authCore } from "./src/modules/auth/controller/core/auth.core";
import { SCHEMAS, registerAuthModels } from "./src/modules/auth/model";
import { env } from "./src/config/env";

async function test() {
    const mainConn = await mongoose.createConnection(env.mongoUri).asPromise();
    registerAuthModels(mainConn);
    const demoConn = await mongoose.createConnection(env.mongoDemoUri).asPromise();
    registerAuthModels(demoConn);

    console.log("Connected to both DBs");

    const email = "test_reset@example.com";
    const oldPassword = "Password@123";
    const newPassword = "New@Password123";

    const User = mainConn.models[SCHEMAS.USER];
    const Otp = mainConn.models[SCHEMAS.OTP];

    // 1. Setup User
    await User.deleteMany({ email });
    const user = await User.create({
        email,
        passwordHash: "$2b$10$YourHashHere...", // will be updated
        role: "admin",
        isActive: true
    });
    const { hashPassword } = require("./src/common/utils/password");
    user.passwordHash = hashPassword(oldPassword);
    await user.save();

    console.log("User created in Main DB");

    // 2. Test Forgot Password
    console.log("\nTesting Forgot Password...");
    const forgotRes = await authCore.forgotPassword({ email }, mainConn);
    console.log("Forgot Password success:", forgotRes.sent === true);

    const otpDoc = await Otp.findOne({ email });
    console.log("OTP generated in DB:", !!otpDoc);
    const otpCode = otpDoc?.otp;

    // 3. Test Verify Code (Reset via OTP)
    console.log("\nTesting Verify Code (OTP Reset)...");
    const verifyRes = await authCore.verifyCode({ email, code: otpCode, newPassword }, mainConn);
    console.log("Verify Code success:", verifyRes.success === true);

    const updatedUser = await User.findOne({ email });
    const { verifyPassword } = require("./src/common/utils/password");
    const isNewPasswordValid = verifyPassword(newPassword, updatedUser.passwordHash);
    console.log("New password is valid:", isNewPasswordValid);

    // 4. Test Change Password (Old/New)
    console.log("\nTesting Change Password (Old/New)...");
    const finalPassword = "Final@Password123";
    const changeRes = await authCore.changePassword({ oldPassword: newPassword, newPassword: finalPassword }, user._id.toString(), mainConn);
    console.log("Change Password success:", changeRes.success === true);

    const finalUser = await User.findOne({ email });
    const isFinalPasswordValid = verifyPassword(finalPassword, finalUser.passwordHash);
    console.log("Final password is valid:", isFinalPasswordValid);

    await mainConn.close();
    await demoConn.close();
    console.log("\nTest Completed");
}

test().catch(console.error);
