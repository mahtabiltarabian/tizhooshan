import { CallHandler, ExecutionContext, Global, Injectable, Module, NestInterceptor, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { Prisma, PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
import { from, lastValueFrom, type Observable } from "rxjs";

/**
 * The database role a signed-in request runs as (migration
 * 20261120140000_row_level_security). Row-level security lets it see only
 * the signed-in user's rows: a parent their own children and everything
 * about them; a teacher their own classrooms, the children in them, and
 * those children's answers from the day they joined.
 */
export const APP_ROLE = "tizhooshan_app";

/** Long enough for a batch of 500 answers and the replay after it. */
const USER_TX = { timeout: 60_000, maxWait: 10_000 };

const scope = new AsyncLocalStorage<Prisma.TransactionClient>();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // No query logging: queries carry children's data. Errors reach the filter.
    super({ log: [], errorFormat: "minimal" });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` in one transaction as APP_ROLE for this user. Every query in
   * it is checked by the database's row-level security, on top of the
   * checks in the services.
   */
  asUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_ROLE}`);
      return scope.run(tx, () => fn(tx));
    }, USER_TX);
  }

  /**
   * The signed-in request's transaction (see UserScope). Services read and
   * write children's data only through this. Outside a signed-in request it
   * throws rather than fall back to the unrestricted connection.
   */
  get db(): Prisma.TransactionClient {
    const tx = scope.getStore();
    if (!tx) throw new Error("No user transaction: children's data is read only inside a signed-in request");
    return tx;
  }
}

/** Every signed-in request (AuthGuard set req.user) runs inside PrismaService.asUser. */
@Injectable()
export class UserScope implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = ctx.switchToHttp().getRequest()?.user as { id: string } | undefined;
    if (!user) return next.handle();
    return from(this.prisma.asUser(user.id, () => lastValueFrom(next.handle(), { defaultValue: undefined })));
  }
}

@Global()
@Module({ providers: [PrismaService, { provide: APP_INTERCEPTOR, useClass: UserScope }], exports: [PrismaService] })
export class PrismaModule {}
