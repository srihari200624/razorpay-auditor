export interface AttackResult {
  attackName: string;
  succeeded: boolean;
  details: string;
  httpStatus: number;
  targetUrl: string;
}
