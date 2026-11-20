import { Module } from "@nestjs/common";
import { AttemptsModule } from "./attempts/attempts.module";
import { AuthModule } from "./auth/auth.module";
import { ChildrenModule } from "./children/children.module";
import { ClassroomsModule } from "./classrooms/classrooms.module";
import { DailyModule } from "./daily/daily.controller";
import { PrismaModule } from "./prisma/prisma.service";
import { ReportsModule } from "./reports/reports.controller";

@Module({
  imports: [PrismaModule, AuthModule, ChildrenModule, AttemptsModule, ClassroomsModule, ReportsModule, DailyModule],
})
export class AppModule {}
