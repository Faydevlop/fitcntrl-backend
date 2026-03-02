import mongoose from "mongoose";
import { authCore } from "./src/modules/auth/controller/core/auth.core";
import { env } from "./src/config/env";
import { hashPassword } from "./src/common/utils/password";
import { getModels } from "./src/modules/auth/model";

async function test() {
    const mainConn = mongoose.createConnection(env.mongoUri);
    const demoConn = mongoose.createConnection(env.mongoDemoUri);

    await Promise.all([
        mainConn.asPromise(),
        demoConn.asPromise()
    ]);

    console.log("Connected to both DBs");

    const mainModels = getModels(mainConn);
    const demoModels = getModels(demoConn);

    // Create test users
    const email = "test-auto@example.com";
    const password = "password123";
    const passwordHash = hashPassword(password);

    await mainModels.User.deleteMany({ email });
    await demoModels.User.deleteMany({ email });

    await mainModels.User.create({
        email,
        passwordHash,
        role: "admin",
        isActive: true
    });
    console.log("Created user in Main DB");

    await demoModels.User.create({
        email,
        passwordHash,
        role: "gym_owner",
        isActive: true
    });
    console.log("Created user in Demo DB");

    // Test Login - Main DB
    console.log("\nTesting Login - Main DB...");
    const mainResult = await authCore.login({ email, password }, mainConn);
    console.log("Main Login Success:", mainResult.user.role === "admin");

    const mainTokenCount = await mainModels.AccessToken.countDocuments({ userId: mainResult.user.id });
    console.log("Main Tokens stored:", mainTokenCount === 1);

    // Test Login - Demo DB
    console.log("\nTesting Login - Demo DB...");
    const demoResult = await authCore.login({ email, password }, demoConn);
    console.log("Demo Login Success:", demoResult.user.role === "gym_owner");

    const demoTokenCount = await demoModels.AccessToken.countDocuments({ userId: demoResult.user.id });
    console.log("Demo Tokens stored:", demoTokenCount === 1);

    await Promise.all([
        mainConn.close(),
        demoConn.close()
    ]);
    console.log("\nTest Completed");
}

test().catch(console.error);
