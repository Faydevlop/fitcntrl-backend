import { userSchema } from "../model/user.model";
import { accessTokenSchema } from "../model/access-token.schema";
import { refreshTokenSchema } from "../model/refresh-token.schema";
import { activityLogSchema } from "./activity-log.schema";
import { otpSchema } from "./otp.schema";
import { Connection } from "mongoose";

export const SCHEMAS = {
    USER: "User",
    ACCESS_TOKEN: "AccessToken",
    REFRESH_TOKEN: "RefreshToken",
    ACTIVITY_LOG: "ActivityLog",
    OTP: "Otp",
};

export const registerAuthModels = (db: Connection) => {
    if (!db.models[SCHEMAS.USER]) db.model(SCHEMAS.USER, userSchema);
    if (!db.models[SCHEMAS.ACCESS_TOKEN]) db.model(SCHEMAS.ACCESS_TOKEN, accessTokenSchema);
    if (!db.models[SCHEMAS.REFRESH_TOKEN]) db.model(SCHEMAS.REFRESH_TOKEN, refreshTokenSchema);
    if (!db.models[SCHEMAS.ACTIVITY_LOG]) db.model(SCHEMAS.ACTIVITY_LOG, activityLogSchema);
    if (!db.models[SCHEMAS.OTP]) db.model(SCHEMAS.OTP, otpSchema);
};
