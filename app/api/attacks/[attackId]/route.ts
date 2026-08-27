import { NextResponse } from "next/server";
import {
  createOrder,
  fakePaymentSuccess,
  forgedSignature,
  webhookReplay,
  type AttackResult,
} from "@/lib/attacks";

const ATTACKS: Record<string, (target: string) => Promise<AttackResult>> = {
  fakePaymentSuccess: async (target) => {
    const order = await createOrder(target);
    return fakePaymentSuccess(target, order.orderId);
  },
  webhookReplay: async (target) => {
    const order = await createOrder(target);
    return webhookReplay(target, order.orderId, order.amountPaise);
  },
  forgedSignature: async (target) => {
    const order = await createOrder(target);
    return forgedSignature(target, order.orderId, order.amountPaise);
  },
};

export async function GET(req: Request, { params }: { params: Promise<{ attackId: string }> }) {
  const { attackId } = await params;
  const target = new URL(req.url).searchParams.get("target");

  if (!target) {
    return NextResponse.json({ error: "Missing target query param" }, { status: 400 });
  }

  const runner = ATTACKS[attackId];
  if (!runner) {
    return NextResponse.json({ error: `Unknown attack "${attackId}"` }, { status: 404 });
  }

  try {
    const result = await runner(target.replace(/\/$/, ""));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
