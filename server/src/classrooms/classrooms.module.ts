import { Module } from "@nestjs/common";
import { ChildAssignmentsController, ClassroomsController } from "./classrooms.controller";
import { ClassroomsService } from "./classrooms.service";

@Module({ controllers: [ClassroomsController, ChildAssignmentsController], providers: [ClassroomsService], exports: [ClassroomsService] })
export class ClassroomsModule {}
