import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { CurrentUser, Roles, type AuthUser } from "../auth/auth.decorators";
import { AttemptsService } from "./attempts.service";

@Controller("attempts")
@Roles("parent")
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post("batch")
  @HttpCode(200)
  batch(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.attempts.batch(user.id, body);
  }
}
