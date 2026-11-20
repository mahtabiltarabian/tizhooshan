// The one door to the app's shared, pure practice code (../src/practice and
// what it imports). The server never reimplements grading, the adaptive
// model, the notebook, sessions, the daily challenge or the report: it runs
// the very functions the app runs. Built with the app's "@/..." alias.

export { ADAPTERS, adapterFor } from "@/practice/adapters";
export { SKILLS } from "@/practice/catalog";
export { answer } from "@/practice/record";
export { scoreOf, stageOf, updateSkill } from "@/practice/adaptive";
export { planSession, type SessionItem } from "@/practice/session";
export { dailyChallenge } from "@/practice/rewards";
export { buildReport, type ReportData } from "@/practice/report";
export { DAY, skillKey, type Attempt, type AttemptMode, type ReviewItem, type SkillState } from "@/practice/types";
export type {
  AssignmentDto,
  AttemptBatchResult,
  AttemptDto,
  ChildDto,
  ClassroomDto,
  Heatmap,
  Role,
  User as UserDto,
  VerifyResponse,
} from "@/practice/api";
