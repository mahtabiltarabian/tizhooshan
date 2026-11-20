import { Controller, Get, Module, Param } from "@nestjs/common";
import { dayOfYmd, parseYmd } from "../common/dates";
import { badRequest } from "../common/errors";
import { dailyChallenge, SKILLS, type SessionItem } from "../shared/practice";

/** The same three puzzles the app builds offline for that date (rewards.ts dailyChallenge). */
@Controller("daily-challenge")
export class DailyController {
  @Get(":date")
  get(@Param("date") date: string): SessionItem[] {
    const d = parseYmd(date);
    if (!d) throw badRequest("bad_date");
    return dailyChallenge(SKILLS, dayOfYmd(d));
  }
}

@Module({ controllers: [DailyController] })
export class DailyModule {}
