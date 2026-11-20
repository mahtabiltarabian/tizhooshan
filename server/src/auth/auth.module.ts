import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController, MeController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { SMS_SENDER, smsSenderFromEnv } from "./sms";

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, { provide: SMS_SENDER, useFactory: smsSenderFromEnv }, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
