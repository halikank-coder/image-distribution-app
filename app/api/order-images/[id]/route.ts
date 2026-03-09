import { NextRequest, NextResponse } from 'next/server';
import { deleteOrderImage, supabaseAdmin } from '@/lib/db';

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const path = searchParams.get('path'); // Storage削除用

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    try {
        // 1. Delete from Storage if path provided
        if (path) {
            const storagePath = path.split('/product-images/').pop();
            if (storagePath) {
                await supabaseAdmin.storage.from('product-images').remove([storagePath]);
            }
        }

        // 2. Delete from DB
        await deleteOrderImage(Number(id));
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Delete order image error:', err);
        return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
    }
}
