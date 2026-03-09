import { NextRequest, NextResponse } from 'next/server';
import { parseOrderCsv } from '@/lib/csvParser';
import { upsertOrder } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const orders = parseOrderCsv(buffer);

        if (orders.length === 0) {
            return NextResponse.json({ error: 'CSVからデータを読み込めませんでした' }, { status: 400 });
        }

        for (const order of orders) {
            await upsertOrder(order);
        }

        return NextResponse.json({ success: true, count: orders.length });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'インポート処理に失敗しました' }, { status: 500 });
    }
}
