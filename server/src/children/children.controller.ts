import { Body, Controller, Delete, Get, HttpCode, Param, Put } from "@nestjs/common";
import { CurrentUser, Roles, type AuthUser } from "../auth/auth.decorators";
import { ChildrenService } from "./children.service";

@Controller("children")
@Roles("parent")
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.children.list(user.id);
  }

  @Put(":id")
  put(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.children.put(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.children.remove(user.id, id);
  }
}
