// Every test process talks to the test database only.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://tizhooshan:tizhooshan@localhost:5434/tizhooshan_test?schema=public";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SMS_SENDER = "dev";
process.env.OTP_SECRET = "test-secret";
// Tests sign in many times a minute from one address; the limits get their own test.
process.env.RATE_LIMIT_PER_MIN = "100000";
process.env.RATE_LIMIT_AUTH_PER_MIN = "100000";
