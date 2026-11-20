import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { CurrentUser, Roles, type AuthUser } from "../auth/auth.decorators";
import { ClassroomsService } from "./classrooms.service";

@Controller("classrooms")
export class ClassroomsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get()
  @Roles("teacher")
  list(@CurrentUser() user: AuthUser) {
    return this.classrooms.list(user.id);
  }

  @Post()
  @Roles("teacher")
  @HttpCode(200)
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.classrooms.create(user.id, body);
  }

  @Post("join")
  @Roles("parent")
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.classrooms.join(user.id, body);
  }

  @Delete(":id")
  @Roles("teacher")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.classrooms.remove(user.id, id);
  }

  @Delete(":id/children/:childId")
  @HttpCode(204)
  async leave(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("childId") childId: string) {
    await this.classrooms.leave(user, id, childId);
  }

  @Get(":id/assignments")
  @Roles("teacher")
  assignments(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.classrooms.assignments(user.id, id);
  }

  @Post(":id/assignments")
  @Roles("teacher")
  @HttpCode(200)
  createAssignment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.classrooms.createAssignment(user.id, id, body);
  }

  @Delete(":id/assignments/:aid")
  @Roles("teacher")
  @HttpCode(204)
  async removeAssignment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("aid") aid: string) {
    await this.classrooms.removeAssignment(user.id, id, aid);
  }

  @Get(":id/heatmap")
  @Roles("teacher")
  heatmap(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.classrooms.heatmap(user.id, id);
  }
}

@Controller("children")
@Roles("parent")
export class ChildAssignmentsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get(":id/assignments")
  list(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.classrooms.childAssignments(user.id, id);
  }
}
