import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, updateOrderStatus, getOrderStats } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    try {
        const [orders, stats] = await Promise.all([
            getAllOrders({ status, search }),
            getOrderStats(),
        ]);
        return NextResponse.json({ orders, stats });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { order_number, status, notes } = body;
        if (!order_number || !status) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }
        await updateOrderStatus(order_number, status, notes);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }
}
