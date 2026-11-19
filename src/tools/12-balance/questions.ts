// All the question types of tool 12: the balance generator's four, plus
// «میانگین» and «مبادله», each from its own generator.

import { makeBalanceQuestion, type BalanceQ, type BalanceQuestionType, type Level } from "@/generators/balance";
import { makeExchangeQuestion, type ExchangeQuestion } from "@/generators/exchange";
import { makeMeanQuestion, type MeanQuestion } from "@/generators/mean";

export type TryType = BalanceQuestionType | "mean" | "exchange";
export type AnyQ = BalanceQ | MeanQuestion | ExchangeQuestion;

export function makeTryQuestion(type: TryType, level: Level, seed: number): AnyQ {
  if (type === "mean") return makeMeanQuestion(level, seed);
  if (type === "exchange") return makeExchangeQuestion(level, seed);
  return makeBalanceQuestion(type, level, seed);
}
